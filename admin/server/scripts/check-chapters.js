const tcb = require('@cloudbase/node-sdk');
require('dotenv').config({ path: '../../.env' });

const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

const db = app.database();

async function checkData() {
  try {
    // 获取课程
    const courses = await db.collection('courses').get();
    console.log('=== 课程列表 ===');
    courses.data.forEach(c => {
      console.log(`ID: ${c._id}, 标题: ${c.title}`);
    });

    // 获取章节
    const chapters = await db.collection('chapters').get();
    console.log('\n=== 章节列表 ===');
    chapters.data.forEach(ch => {
      console.log(`ID: ${ch._id}, 标题: ${ch.title}, course: ${ch.course}`);
    });

  } catch (err) {
    console.error('查询失败:', err);
  }
}

checkData();
