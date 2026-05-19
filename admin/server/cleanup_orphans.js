require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const cloudbase = require('@cloudbase/node-sdk');

const ENV_ID = process.env.TCB_ENV_ID || 'cloud1-2g5y53suf638dfb9';
const SECRET_ID = process.env.TCB_SECRET_ID || '';
const SECRET_KEY = process.env.TCB_SECRET_KEY || '';

const tcb = cloudbase.init({
  env: ENV_ID,
  secretId: SECRET_ID,
  secretKey: SECRET_KEY
});

async function cleanup() {
  const db = tcb.database();
  
  // 获取所有课程
  const coursesRes = await db.collection('courses').get();
  const validCourseIds = new Set(coursesRes.data.map(c => c._id));
  console.log(`有效课程数: ${validCourseIds.size}`);
  
  // 获取所有音频
  const audiosRes = await db.collection('audios').limit(1000).get();
  const allAudios = audiosRes.data;
  console.log(`总音频数: ${allAudios.length}`);
  
  // 找出孤儿音频
  const orphans = allAudios.filter(a => !a.course || !validCourseIds.has(a.course));
  console.log(`孤儿音频数: ${orphans.length}`);
  
  for (const audio of orphans) {
    try {
      if (audio.audioFile) {
        try { await tcb.deleteFile({ fileList: [audio.audioFile] }); } catch(e) {}
      }
      await db.collection('audios').doc(audio._id).remove();
      console.log(`已删除: ${audio.title || audio._id}`);
    } catch (e) {
      console.log(`删除失败 ${audio._id}: ${e.message}`);
    }
  }
  
  console.log(`完成，共删除 ${orphans.length} 条`);
}

cleanup().catch(console.error);
