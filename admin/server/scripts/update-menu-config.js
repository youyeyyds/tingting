const tcb = require('@cloudbase/node-sdk');
require('dotenv').config({ path: '../../.env' });

const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

const db = app.database();

async function updateMenuConfig() {
  try {
    // 检查是否存在菜单配置
    const existing = await db.collection('system_config').doc('menu_config').get();
    
    const newMenuOrder = ['courses', 'audios', 'headlines', 'categories', 'users', 'roles', 'system'];
    
    if (existing.data && existing.data.length > 0) {
      // 更新
      const result = await db.collection('system_config').doc('menu_config').update({
        menuOrder: newMenuOrder
      });
      console.log('菜单配置已更新:', newMenuOrder);
    } else {
      // 创建
      const result = await db.collection('system_config').add({
        _id: 'menu_config',
        menuOrder: newMenuOrder
      });
      console.log('菜单配置已创建:', newMenuOrder);
    }
  } catch (err) {
    console.error('操作失败:', err);
  }
}

updateMenuConfig();
