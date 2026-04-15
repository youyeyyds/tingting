const tcb = require('@cloudbase/node-sdk');
require('dotenv').config({ path: '../../.env' });

const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

const db = app.database();

async function createHeadlinesTable() {
  try {
    // 添加一条测试数据来创建表
    const result = await db.collection('headlines').add({
      seq: 1,
      title: '欢迎使用听听',
      image: 'https://picsum.photos/seed/headline1/400/200',
      link: '',
      _createTime: new Date()
    });
    console.log('头条表已创建，测试数据已添加');
    console.log('结果:', result);
  } catch (err) {
    console.error('创建失败:', err);
  }
}

createHeadlinesTable();
