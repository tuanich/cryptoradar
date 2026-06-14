import { sendTelegram } from '../../../lib/telegramBot';
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const{message}=req.body;
  if(!message)return res.status(400).json({error:'message required'});
  try{const ok=await sendTelegram(message);res.status(200).json({ok});}
  catch(e){res.status(500).json({error:e.message});}
}