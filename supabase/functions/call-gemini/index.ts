import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// インポートパスは './_shared/cors.ts' を参照します
import { corsHeaders } from './_shared/cors.ts';

console.log('[Function Start] "call-gemini" function invoked.');

// 環境変数から Supabase と Gemini の設定を読み込みます
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

Deno.serve(async (req) => {
  // CORS プリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Handling OPTIONS pre-flight request.');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. 認証トークンの検証
    console.log('[Auth Verify] Verifying user authentication token.');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header.');
    }

    // Supabaseクライアントを初期化 (認証ヘッダー付き)
    const supabaseClient = createClient(
        SUPABASE_URL ?? '',
        SUPABASE_ANON_KEY ?? '',
        { global: { headers: { Authorization: authHeader } } }
    );

    // ユーザー情報を取得
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[Auth Verify] Failed:', userError?.message || 'No user found.');
      return new Response(JSON.stringify({ error: 'Authentication failed.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`[Auth Verify] Success. User ID: ${user.id}`);

    // 2. Gemini APIキーの確認
    const geminiApiKey = GEMINI_API_KEY; // 変数名を合わせる
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set in Supabase secrets.');
    }

    // リクエストボディを取得
    const requestPayload = await req.json();

    // 3. Gemini APIへリクエストを転送
    // ★ ストラテジーデザイナーの添付ファイルに記載されていたモデルを使用
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;

    console.log('[Gemini Request] Sending request to Gemini API.');
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    // Gemini APIからのエラーハンドリング
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text(); // エラー内容をテキストで取得
      console.error(`[Gemini Request] Failed with status ${geminiResponse.status}:`, errorBody);
      throw new Error(`Gemini API error: Status ${geminiResponse.status} - ${errorBody}`);
    }

    // 成功時のレスポンスを取得
    const responseData = await geminiResponse.json();
    console.log('[Gemini Request] Successfully received response from Gemini API.');

    // 4. 結果をクライアントに返す
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // OK
    });

  } catch (error) {
    // 予期せぬエラーのハンドリング
    console.error('[Error] An unexpected error occurred:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Internal Server Error
    });
  }
});

