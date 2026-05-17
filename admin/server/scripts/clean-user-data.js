/**
 * 清理 userChapterSettings 和 userProgress 中无效的记录
 * 无效记录指 chapterId 对应的章节已不存在
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({
  env: process.env.TCB_ENV_ID || 'cloud1-2g5y53suf638dfb9',
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

async function cleanOrphanedRecords() {
  try {
    const db = app.database();

    console.log('开始检查无效记录...\n');

    // 获取所有章节ID
    const chaptersResult = await db.collection('chapters').field({ _id: true }).get();
    const validChapterIds = new Set(chaptersResult.data.map(ch => ch._id));
    console.log(`共有 ${validChapterIds.size} 个有效章节`);

    // 检查 userChapterSettings
    let orphanedSettings = 0;
    try {
      const settingsResult = await db.collection('userChapterSettings').get();
      console.log(`\nuserChapterSettings 表共有 ${settingsResult.data.length} 条记录`);

      for (const setting of settingsResult.data) {
        if (!validChapterIds.has(setting.chapterId)) {
          orphanedSettings++;
          await db.collection('userChapterSettings').doc(setting._id).remove();
          console.log(`  删除无效 settings: ${setting._id} (chapterId: ${setting.chapterId})`);
        }
      }
      console.log(`共删除 ${orphanedSettings} 条无效 userChapterSettings`);
    } catch (e) {
      console.log(`userChapterSettings 表不存在或无法访问: ${e.message}`);
    }

    // 检查 userProgress
    let orphanedProgress = 0;
    try {
      const progressResult = await db.collection('userProgress').get();
      console.log(`\nuserProgress 表共有 ${progressResult.data.length} 条记录`);

      for (const progress of progressResult.data) {
        if (!validChapterIds.has(progress.chapterId)) {
          orphanedProgress++;
          await db.collection('userProgress').doc(progress._id).remove();
          console.log(`  删除无效 progress: ${progress._id} (chapterId: ${progress.chapterId})`);
        }
      }
      console.log(`共删除 ${orphanedProgress} 条无效 userProgress`);
    } catch (e) {
      console.log(`userProgress 表不存在或无法访问: ${e.message}`);
    }

    console.log('\n清理完成！');
    process.exit(0);
  } catch (err) {
    console.error('清理失败:', err.message);
    process.exit(1);
  }
}

cleanOrphanedRecords();