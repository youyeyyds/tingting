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
    // 检查 config 表
    const result = await db.collection('config').where({ key: 'menuOrder' }).limit(1).get();
    console.log('config 表 menuOrder 数据:', JSON.stringify(result.data, null, 2));
  } catch (err) {
    console.error('查询 config 表失败:', err.message);
    
    // 检查 system_config 表
    try {
      const result2 = await db.collection('system_config').get();
      console.log('system_config 表数据:', JSON.stringify(result2.data, null, 2));
    } catch (err2) {
      console.error('查询 system_config 表失败:', err2.message);
    }
  }
}

checkConfig();
