/**
 * 同步章节音频数据
 * 清除已删除音频关联的章节 audioUrl
 */

const tcb = require('@cloudbase/node-sdk');

// 从 .env 读取配置
require('dotenv').config({ path: '../../.env' });

const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

const db = app.database();

async function syncChapterAudio() {
  try {
    console.log('开始同步章节音频数据...');

    // 1. 获取所有音频的 audioFile（云存储文件ID）
    const audiosResult = await db.collection('audios').get();
    const audioFiles = audiosResult.data.map(a => a.audioFile);
    console.log('现有音频文件数量:', audioFiles.length);

    // 2. 获取所有章节
    const chaptersResult = await db.collection('chapters').get();
    console.log('章节总数:', chaptersResult.data.length);

    // 3. 检查每个章节的 audioUrl 是否还在音频列表中
    let updatedCount = 0;
    for (const chapter of chaptersResult.data) {
      if (chapter.audioUrl && chapter.audioUrl.trim() !== '') {
        // 检查这个 audioUrl 是否还在音频列表中
        const existsInAudios = audioFiles.includes(chapter.audioUrl);

        if (!existsInAudios) {
          console.log(`清除章节 ${chapter.title} 的无效 audioUrl: ${chapter.audioUrl}`);
          await db.collection('chapters').doc(chapter._id).update({
            audioUrl: '',
            audioFileSize: 0
          });
          updatedCount++;
        }
      }
    }

    console.log(`同步完成，更新了 ${updatedCount} 个章节`);
  } catch (err) {
    console.error('同步失败:', err);
  }
}

syncChapterAudio();