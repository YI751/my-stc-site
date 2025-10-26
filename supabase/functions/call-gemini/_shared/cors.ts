// ★ ストラテジーデザイナーの cors.ts と全く同じ内容
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 本番環境では '*' を Netlify の URL に変更推奨
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};