// 標準的なCORSヘッダー
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 本番環境では特定のオリジンに変更することを推奨
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};