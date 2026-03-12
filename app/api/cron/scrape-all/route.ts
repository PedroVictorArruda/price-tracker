import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // VerificaÃ§Ã£o de seguranÃ§a para o cron job
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET && 
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // TODO: Obter os produtos ativos no banco e rodar o scraper para validar preÃ§os
    console.log('Running scheduled scrape for all products...');
    
    return NextResponse.json({ success: true, message: 'Cron job executed successfully' });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

