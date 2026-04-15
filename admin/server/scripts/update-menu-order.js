const tcb = require('@cloudbase/node-sdk');
require('dotenv').config({ path: '../../.env' });

const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

const db = app.database();

async function updateMenuOrder() {
  try {
    const newOrder = ['courses', 'audios', 'headlines', 'categories', 'users', 'roles', 'system'];
    
    // 更新数据库中的菜单配置
    const result = await db.collection('config')
      .where({ key: 'menuOrder' })
      .update({
        value: newOrder,
        updateTime: new Date()
      });
    
    console.log('更新结果:', result);
    console.log('新菜单顺序:', newOrder);
  } catch (err) {
    console.error('更新失败:', err);
  }
}

updateMenuOrder();
