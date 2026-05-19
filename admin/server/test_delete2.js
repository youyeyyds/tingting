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
  console.log('有效课程IDs:', Array.from(validIds));
  
  // 获取所有音频不过滤
  const audiosRes = await db.collection('audios').limit(1000).get();
  console.log('总音频数:', audiosRes.data.length);
  
  // 检查前几个音频的course字段
  for (let i = 0; i < Math.min(5, audiosRes.data.length); i++) {
    const a = audiosRes.data[i];
    const inValid = validIds.has(a.course);
    console.log(`音频${i}: course=${a.course}, 在有效课程中=${inValid}, title=${a.title}`);
  }
  
  // 检查无course的音频
  const noCourse = audiosRes.data.filter(a => !a.course);
  console.log('无course字段的音频数:', noCourse.length);
  
  // 检查course不在有效列表的
  const notInList = audiosRes.data.filter(a => a.course && !validIds.has(a.course));
  console.log('course不在有效列表的:', notInList.length);
}

test().catch(e => console.error(e.message));
