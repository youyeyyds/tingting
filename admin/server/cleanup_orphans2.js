require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const cloudbase = require('@cloudbase/node-sdk');

const tcb = cloudbase.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

async function cleanup() {
  const db = tcb.database();
  
  const coursesRes = await db.collection('courses').get();
  const validCourseIds = new Set(coursesRes.data.map(c => c._id));
  console.log(`有效课程数: ${validCourseIds.size}`);
  
  // 循环删除，直到没有孤儿
  let deleted = 0;
  while (true) {
    const audiosRes = await db.collection('audios').limit(100).get();
    const allAudios = audiosRes.data;
    
    const orphans = allAudios.filter(a => a.course && !validCourseIds.has(a.course));
    
    if (orphans.length === 0) {
      // 检查后面是否还有
      const moreRes = await db.collection('audios').where({ course: db.command.neq(null) }).limit(1000).get();
      const allOrphans = moreRes.data.filter(a => a.course && !validCourseIds.has(a.course));
      if (allOrphans.length === 0) break;
      console.log(`后面还有 ${allOrphans.length} 个孤儿，继续删除...`);
      continue;
    }
    
    for (const audio of orphans) {
      try {
        await db.collection('audios').doc(audio._id).remove();
        deleted++;
        process.stdout.write(`\r已删除: ${deleted}`);
      } catch (e) {
        console.log(`\n删除失败 ${audio._id}: ${e.message}`);
      }
    }
  }
  
  console.log(`\n清理完成，共删除 ${deleted} 条孤儿音频`);
}

cleanup().catch(console.error);
