/**
 * 导入金庸小说武功数据到数据库
 * 用法: node import-martial-arts.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 使用 admin/server/node_modules 中的 cloudbase 和 dotenv
const tcb = require('../admin/server/node_modules/@cloudbase/node-sdk');
require('../admin/server/node_modules/dotenv').config({ path: path.join(__dirname, '../.env') });
function readCSV(filePath) {
  try {
    // 使用iconv转换编码
    const content = execSync(`iconv -f GBK -t UTF-8 "${filePath}"`, {
      encoding: 'utf-8'
    });
    return content;
  } catch (err) {
    console.error('读取文件失败:', err);
    process.exit(1);
  }
}

// 解析CSV
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const result = [];

  for (const line of lines) {
    // 按逗号分隔，但处理引号内的逗号
    const parts = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());

    if (parts.length >= 1 && parts[0]) {
      result.push({
        name: parts[0] || '',
        type: parts[1] || '',
        description: parts[2] || '',
        characters: parts[3] || '',
        faction: parts[4] || '',
        novel: parts[5] || ''
      });
    }
  }

  return result;
}

// 指定的小说排序
const NOVEL_ORDER = [
  '飞狐外传', '雪山飞狐', '连城诀', '天龙八部', '射雕英雄传',
  '白马啸西风', '鹿鼎记', '笑傲江湖', '书剑恩仇录', '神雕侠侣',
  '侠客行', '倚天屠龙记', '碧血剑', '鸳鸯刀', '越女剑'
]

// 去重并收集唯一值
function collectUnique(data) {
  const types = new Set();
  const factions = new Set();
  const novels = new Set();
  const characters = new Set();

  for (const item of data) {
    if (item.type) types.add(item.type.trim());
    if (item.faction) factions.add(item.faction.trim());
    if (item.novel) {
      // 清理小说名称：去除前后空白、控制字符等
      const novelName = item.novel.trim().replace(/[\x00-\x1F\x7F]/g, '');
      novels.add(novelName);
    }
    if (item.characters) {
      const charList = item.characters.split('、');
      charList.forEach(c => {
        if (c.trim()) characters.add(c.trim());
      });
    }
  }

  // 按指定顺序排序小说，未知的小说排在最后
  const sortedNovels = Array.from(novels).sort((a, b) => {
    const indexA = NOVEL_ORDER.indexOf(a);
    const indexB = NOVEL_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return {
    types: Array.from(types).sort(),
    factions: Array.from(factions).sort(),
    novels: sortedNovels,
    characters: Array.from(characters).sort()
  };
}

// 主函数
async function importData() {
  console.log('开始导入武功数据...\n');

  // 读取CSV
  const csvPath = path.join(__dirname, '金庸小说武功大全.csv');
  console.log('读取文件:', csvPath);
  const content = readCSV(csvPath);
  const rawData = parseCSV(content);
  console.log(`读取到 ${rawData.length} 条武功记录\n`);

  // 收集唯一值
  const unique = collectUnique(rawData);
  console.log('唯一类型:', unique.types.length);
  console.log('唯一门派:', unique.factions.length);
  console.log('唯一小说:', unique.novels.length);
  console.log('唯一人物:', unique.characters.length);

  // 动态导入cloudbase
  let app, db;
  try {
    app = tcb.init({
      env: process.env.TCB_ENV_ID,
      secretId: process.env.TCB_SECRET_ID,
      secretKey: process.env.TCB_SECRET_KEY
    });
    db = app.database();
    console.log('\n数据库连接成功');
  } catch (err) {
    console.error('数据库连接失败:', err.message);
    console.log('请确保已运行 create-martial-arts.js 创建集合');
    process.exit(1);
  }

  // 清空现有数据
  console.log('\n清空现有数据...');
  const collections = ['martialArtCharacterRelations', 'martialArts', 'martialArtTypes', 'martialArtFactions', 'martialArtNovels', 'martialArtCharacters'];
  for (const collName of collections) {
    let totalDeleted = 0;
    try {
      // 循环删除直到全部清空
      while (true) {
        const allRecords = await db.collection(collName).limit(100).get();
        if (allRecords.data.length === 0) break;
        const ids = allRecords.data.map(r => r._id);
        const result = await db.collection(collName).where({ _id: db.command.in(ids) }).remove({});
        totalDeleted += result.deleted;
        if (allRecords.data.length < 100) break;
      }
      console.log(`  清空 ${collName}: ${totalDeleted} 条`);
    } catch (err) {
      console.log(`  清空 ${collName} 失败: ${err.message}`);
    }
  }

  // 导入类型
  console.log('\n导入类型...');
  const typeIdMap = {};
  for (let i = 0; i < unique.types.length; i++) {
    const name = unique.types[i];
    try {
      const result = await db.collection('martialArtTypes').add({
        seq: i + 1,
        name: name,
        _createTime: new Date()
      });
      typeIdMap[name] = result.id;
      console.log(`  类型[${i + 1}/${unique.types.length}]: ${name}`);
    } catch (err) {
      console.error(`  添加类型失败: ${name}`, err.message);
    }
  }

  // 导入门派
  console.log('\n导入门派...');
  const factionIdMap = {};
  for (let i = 0; i < unique.factions.length; i++) {
    const name = unique.factions[i];
    try {
      const result = await db.collection('martialArtFactions').add({
        seq: i + 1,
        name: name,
        _createTime: new Date()
      });
      factionIdMap[name] = result.id;
      console.log(`  门派[${i + 1}/${unique.factions.length}]: ${name}`);
    } catch (err) {
      console.error(`  添加门派失败: ${name}`, err.message);
    }
  }

  // 导入小说
  console.log('\n导入小说...');
  const novelIdMap = {};
  for (let i = 0; i < unique.novels.length; i++) {
    const name = unique.novels[i];
    try {
      const result = await db.collection('martialArtNovels').add({
        seq: i + 1,
        name: name,
        _createTime: new Date()
      });
      novelIdMap[name] = result.id;
      console.log(`  小说[${i + 1}/${unique.novels.length}]: ${name}`);
    } catch (err) {
      console.error(`  添加小说失败: ${name}`, err.message);
    }
  }

  // 导入人物
  console.log('\n导入人物...');
  const characterIdMap = {};
  for (let i = 0; i < unique.characters.length; i++) {
    const name = unique.characters[i];
    try {
      const result = await db.collection('martialArtCharacters').add({
        seq: i + 1,
        name: name,
        _createTime: new Date()
      });
      characterIdMap[name] = result.id;
      console.log(`  人物[${i + 1}/${unique.characters.length}]: ${name}`);
    } catch (err) {
      console.error(`  添加人物失败: ${name}`, err.message);
    }
  }

  // 导入武功
  console.log('\n导入武功...');
  const martialArtIdMap = {};
  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    // 用名称+小说ID作为复合key，避免同一武功不同小说互相覆盖
    const mapKey = `${item.name}__${item.novel}`;
    try {
      const result = await db.collection('martialArts').add({
        seq: i + 1,
        name: item.name,
        description: item.description,
        typeId: typeIdMap[item.type] || '',
        factionId: factionIdMap[item.faction] || '',
        novelId: novelIdMap[item.novel] || '',
        _createTime: new Date()
      });
      martialArtIdMap[mapKey] = result.id;
      if ((i + 1) % 50 === 0) {
        console.log(`  武功[${i + 1}/${rawData.length}]: ${item.name}`);
      }
    } catch (err) {
      console.error(`  添加武功失败: ${item.name}`, err.message);
    }
  }
  console.log(`  武功导入完成，共 ${rawData.length} 条\n`);

  // 导入武功人物关联
  console.log('导入武功人物关联...');
  let relationCount = 0;
  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    const mapKey = `${item.name}__${item.novel}`;
    const martialArtId = martialArtIdMap[mapKey];
    if (!martialArtId || !item.characters) continue;

    const charList = item.characters.split('、');
    for (const charName of charList) {
      const trimmedName = charName.trim();
      if (!trimmedName) continue;
      const characterId = characterIdMap[trimmedName];
      if (!characterId) continue;

      try {
        await db.collection('martialArtCharacterRelations').add({
          martialArtId: martialArtId,
          characterId: characterId,
          _createTime: new Date()
        });
        relationCount++;
      } catch (err) {
        console.error(`  添加关联失败: ${item.name} - ${trimmedName}`, err.message);
      }
    }
  }
  console.log(`  关联导入完成，共 ${relationCount} 条\n`);

  console.log('===========================================');
  console.log('导入完成！');
  console.log(`  类型: ${unique.types.length}`);
  console.log(`  门派: ${unique.factions.length}`);
  console.log(`  小说: ${unique.novels.length}`);
  console.log(`  人物: ${unique.characters.length}`);
  console.log(`  武功: ${rawData.length}`);
  console.log(`  关联: ${relationCount}`);
  console.log('===========================================');
}

importData().catch(console.error);
