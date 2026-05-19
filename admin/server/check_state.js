require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const cloudbase = require('@cloudbase/node-sdk');

const tcb = cloudbase.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

async function check() {
  const db = tcb.database();
  
  // 获取所有课程
  const coursesRes = await db.collection('courses').get();
  const courses = coursesRes.data;
  const validCourseIds = new Set(courses.map(c => c._id));
  console.log(`课程数: ${courses.length}`);
  courses.forEach(c => console.log(`  - ${c.title}: ${c._id}`));
  
  // 获取所有音频（加limit）
  const audiosRes = await db.collection('audios').limit(2000).get();
  const allAudios = audiosRes.data;
  console.log(`\n音频总数（数据库查询）: ${allAudios.length}`);
  
  // 按课程分组统计
  const byCourse = {};
  allAudios.forEach(a => {
    const cid = a.course || '(无)';
    byCourse[cid] = (byCourse[cid] || 0) + 1;
  });
  console.log('\n按课程分组的音频数:');
  Object.entries(byCourse).forEach(([cid, count]) => {
    const course = courses.find(c => c._id === cid);
    const name = course ? course.title : '(未找到课程)';
    const valid = validCourseIds.has(cid) ? '' : ' [孤儿]';
    console.log(`  ${name}: ${count}${valid}`);
  });
  
  // 孤儿统计
  const orphans = allAudios.filter(a => !a.course || !validCourseIds.has(a.course));
  console.log(`\n孤儿音频: ${orphans.length}`);
  
  // 检查 chapters 表
  const chaptersRes = await db.collection('chapters').limit(2000).get();
  console.log(`\n章节总数: ${chaptersRes.data.length}`);
  
  // 检查 userProgress 表
  const progressRes = await db.collection('userProgress').limit(2000).get();
  console.log(`用户进度记录数: ${progressRes.data.length}`);
}

check().catch(console.error);
