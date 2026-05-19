const cloudbase = require('@cloudbase/node-sdk');

const ENV_ID = process.env.TCB_ENV_ID || 'cloud1-2g5y53suf638dfb9';
const SECRET_ID = process.env.TCB_SECRET_ID || '';
const SECRET_KEY = process.env.TCB_SECRET_KEY || '';

async function cleanup() {
  const tcb = cloudbase.init({
    env: ENV_ID,
    secretId: SECRET_ID,
    secretKey: SECRET_KEY
  });
  
  const db = tcb.database();
  
  // 获取所有课程，构建有效course ID列表
  const coursesRes = await db.collection('courses').get();
  const validCourseIds = new Set(coursesRes.data.map(c => c._id));
  console.log(`有效课程数: ${validCourseIds.size}`);
  
  // 获取所有音频
  const audiosRes = await db.collection('audios').limit(1000).get();
  const allAudios = audiosRes.data;
  console.log(`总音频数: ${allAudios.length}`);
  
  // 找出孤儿音频（course字段无效的）
  const orphanAudios = allAudios.filter(a => {
    if (!a.course) return true;  // course为空
    if (!validCourseIds.has(a.course)) return true;  // course不存在
    return false;
  });
  
  console.log(`孤儿音频数: ${orphanAudios.length}`);
  
  if (orphanAudios.length === 0) {
    console.log('没有孤儿音频需要清理');
    return;
  }
  
  // 删除孤儿音频
  for (const audio of orphanAudios) {
    try {
      // 先删除云存储文件
      if (audio.audioFile) {
        try {
          await tcb.deleteFile({ fileList: [audio.audioFile] });
        } catch (e) {
          console.log(`删除云文件失败 ${audio.audioFile}: ${e.message}`);
        }
      }
      // 删除数据库记录
      await db.collection('audios').doc(audio._id).remove();
      console.log(`已删除孤儿音频: ${audio.title || audio._id} (course: ${audio.course || '空'})`);
    } catch (e) {
      console.log(`删除音频失败 ${audio._id}: ${e.message}`);
    }
  }
  
  console.log(`清理完成，共删除 ${orphanAudios.length} 条孤儿音频`);
}

cleanup().catch(console.error);
