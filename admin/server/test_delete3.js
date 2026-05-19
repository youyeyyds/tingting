require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const cloudbase = require('@cloudbase/node-sdk');

const tcb = cloudbase.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

async function test() {
  const db = tcb.database();
  
  const coursesRes = await db.collection('courses').get();
  const validIds = new Set(coursesRes.data.map(c => c._id));
  
  const audiosRes = await db.collection('audios').limit(1000).get();
  const orphan = audiosRes.data.find(a => a.course && !validIds.has(a.course));
  
  if (!orphan) {
    console.log('没找到孤儿音频');
    return;
  }
  
  console.log('找到孤儿音频:', orphan.title, orphan._id, 'course:', orphan.course);
  
  try {
    const del = await db.collection('audios').doc(orphan._id).remove();
    console.log('删除结果:', JSON.stringify(del));
  } catch(e) {
    console.log('删除失败:', e.message, e.code, e.requestId);
  }
}

test().catch(e => console.error(e.message));
