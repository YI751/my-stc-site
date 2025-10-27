// Supabase Edge Function: call-gemini
// クライアントからのリクエストを受け取り、認証チェックを行った上で、
// サーバーサイドのGEMINI_API_KEYを使用してGemini APIにリクエストを転送します。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts'; // 共有CORS設定をインポート

console.log('[Function Start] "call-gemini" function invoked.');

Deno.serve(async (req) => {
  // CORSプリフライトリクエスト（OPTIONSメソッド）の処理
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Handling OPTIONS pre-flight request.');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. クライアントからのJWT（認証トークン）を使用してユーザーを認証
    console.log('[Auth Verify] Verifying user authentication token.');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header.');
    }

    // 環境変数からSupabaseのURLとAnonキーを読み込み、クライアントを作成
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      // グローバルヘッダーにクライアントから受け取った認証トークンを設定
      { global: { headers: { Authorization: authHeader } } }
    );

    // トークンを検証してユーザー情報を取得
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[Auth Verify] Failed:', userError?.message || 'No user found.');
      return new Response(
        JSON.stringify({ error: 'Authentication failed.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[Auth Verify] Success. User ID: ${user.id}`);

    // 2. SupabaseのSecretsに設定されたGemini APIキーを安全に読み込む
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('[Config Error] GEMINI_API_KEY is not set in Supabase secrets.');
      throw new Error('GEMINI_API_KEY is not set in Supabase secrets.');
    }

    // クライアントから送信されたリクエストボディ（プロンプトなど）を取得
    const requestPayload = await req.json();

    // 3. Gemini APIにリクエストを転送
    // 「ストラテジーデザイナー」の構成に合わせ、'gemini-2.5-flash' (v1) を使用
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    console.log('[Gemini Request] Sending request to Gemini API.');
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    // Gemini APIからのエラーハンドリング
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error(`[Gemini Request] Failed with status ${geminiResponse.status}:`, errorBody);
      throw new Error(`Gemini API error: ${errorBody}`);
    }

    const responseData = await geminiResponse.json();
    console.log('[Gemini Request] Successfully received response from Gemini API.');

    // 4. Gemini APIのレスポンスをクライアントに返却
    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // 予期せぬエラーの処理
    console.error('[Error] An unexpected error occurred:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});