const tcb = require('@cloudbase/node-sdk');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY
});

const db = app.database();

async function createMartialArtsTables() {
  try {
    // 1. 创建类型表
    await db.collection('martialArtTypes').add({
      seq: 1,
      name: '拳法'
    });
    console.log('martialArtTypes 表已创建');

    // 2. 创建门派表
    await db.collection('martialArtFactions').add({
      seq: 1,
      name: '丐帮'
    });
    console.log('martialArtFactions 表已创建');

    // 3. 创建小说表
    await db.collection('martialArtNovels').add({
      seq: 1,
      name: '飞狐外传'
    });
    console.log('martialArtNovels 表已创建');

    // 4. 创建人物表
    await db.collection('martialArtCharacters').add({
      seq: 1,
      name: '胡斐'
    });
    console.log('martialArtCharacters 表已创建');

    // 5. 创建武功主表
    await db.collection('martialArts').add({
      seq: 1,
      name: '查拳',
      description: '与潭腿、花拳、洪拳，并称北拳四大家的拳法',
      typeId: '',
      factionId: '',
      novelId: '',
      _createTime: new Date()
    });
    console.log('martialArts 表已创建');

    // 6. 创建武功人物关联表
    await db.collection('martialArtCharacterRelations').add({
      martialArtId: '',
      characterId: ''
    });
    console.log('martialArtCharacterRelations 表已创建');

    console.log('\n所有武功相关表已创建完成！');
  } catch (err) {
    console.error('创建失败:', err);
  }
}

createMartialArtsTables();
