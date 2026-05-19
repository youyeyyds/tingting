require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const cloudbase = require('@cloudbase/node-sdk');

const tcb = cloudbase.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

async function test() {
  const db = tcb.database();
  
  // 模拟 dashboard 的 API 调用（无筛选条件）
  const collection = db.collection('audios');
  const countResult = await collection.where({}).count();
  console.log('countResult.total:', countResult.total);
  
  // 带查询条件的 count
  const allRes = await collection.limit(2000).get();
  console.log('实际数据库中的音频数:', allRes.data.length);
}

test().catch(e => console.error(e.message));
