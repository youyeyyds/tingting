const tcb = require('@cloudbase/node-sdk');
require('dotenv').config({ path: '../../.env' });

const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

const db = app.database();

async function createMenuConfig() {
  try {
    const newMenuOrder = ['courses', 'audios', 'headlines', 'categories', 'users', 'roles', 'system'];
    
    // 直接添加，如果表不存在会自动创建
    const result = await db.collection('system_config').add({
      _id: 'menu_config',
      menuOrder: newMenuOrder
    });
    console.log('菜单配置已创建:', result);
    console.log('菜单顺序:', newMenuOrder);
  } catch (err) {
    console.error('创建失败:', err);
  }
}

createMenuConfig();
