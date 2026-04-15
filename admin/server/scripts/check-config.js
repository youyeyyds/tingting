const tcb = require('@cloudbase/node-sdk');
require('dotenv').config({ path: '../../.env' });

const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

const db = app.database();

async function checkConfig() {
  try {
    const result = await db.collection('system_config').get();
    console.log('system_config 表数据:', JSON.stringify(result.data, null, 2));
  } catch (err) {
    console.error('查询失败:', err.message);
  }
}

checkConfig();
