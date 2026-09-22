/**
 * Agent game icon asset helpers:
 * - IconRoleCircle: circular agent avatar icon (IconRoleCircle<spriteId>.webp)
 * - IconRoleSelect: vertical agent selector strip in ZZZ menu style
 * - IconRoleGeneral: horizontal agent placard
 * Sprite numbers mapped from game data / partnerId2Data.
 * CDN: static.nanoka.cc. Key is agent ID (= in-game avatar ID).
 */
const ICON_CIRCLE_BASE = 'https://static.nanoka.cc/assets/zzz/IconRoleCircle'
const ICON_SELECT_BASE = 'https://static.nanoka.cc/assets/zzz/IconRoleSelect'
const ICON_GENERAL_BASE = 'https://static.nanoka.cc/assets/zzz/IconRoleGeneral'

const AGENT_SPRITE_IDS: Record<number, string> = {
  1011: '01', // Anby
  1021: '11', // Nekomata
  1031: '12', // Nicole
  1041: '05', // Soldier 11
  1051: '52', // Yidhari
  1061: '09', // Corin
  1071: '25', // Caesar
  1081: '10', // Billy
  1091: '13', // Miyabi
  1101: '14', // Koleda
  1111: '15', // Anton
  1121: '16', // Ben
  1131: '17', // Soukaku
  1141: '18', // Lycaon
  1151: '27', // Lucy
  1161: '26', // Lighter
  1171: '32', // Burnice
  1181: '20', // Grace
  1191: '21', // Ellen
  1201: '35', // Harumasa
  1211: '22', // Rina
  1221: '31', // Yanagi
  1241: '23', // Zhu Yuan
  1251: '29', // QingYi
  1261: '24', // Jane
  1271: '30', // Seth
  1281: '28', // Piper
  1291: '42', // Hugo
  1301: '49', // Orphie & Magus
  1311: '36', // Astra
  1321: '37', // Evelyn
  1331: '41', // Vivian
  1341: '56', // Zhao
  1351: '38', // Pulchra
  1361: '39', // Trigger
  1371: '44', // Yixuan
  1381: '40', // Soldier 0 - Anby
  1391: '43', // Ju Fufu
  1401: '46', // Alice
  1411: '47', // Yuzuha
  1421: '45', // Yinhu
  1431: '55', // Ye Shunguang
  1441: '51', // Manato
  1451: '50', // Lucia
  1461: '48', // Seed
  1471: '53', // BanYue
  1481: '54', // Dialyn
  1491: '58', // Sunna
  1501: '57', // Aria
  1511: '59', // NangongYu
  1521: '60', // Cissia
  1531: '62', // Starlight - Billy
  1541: '61', // Promeia
  1551: '63', // Pyrois
  1561: '64', // Velina
  1571: '65', // Norma
  1581: '67', // Remielle
  1591: '66', // Sigrid
  1611: '1611', // Claret
  1621: '68', // Roxy / Pryce
}

export function agentRoleCircleUrl(agentId: number | string): string | undefined {
  const sprite = AGENT_SPRITE_IDS[Number(agentId)]
  if (sprite) {
    return `${ICON_CIRCLE_BASE}${sprite}.webp`
  }
  return `https://enka.network/ui/zzz/IconRoleCircle${agentId}.png`
}

export function agentRoleSelectUrl(agentId: number | string): string | undefined {
  const sprite = AGENT_SPRITE_IDS[Number(agentId)]
  return sprite ? `${ICON_SELECT_BASE}${sprite}.webp` : undefined
}

export function agentRoleIconUrl(agentId: number | string): string | undefined {
  const sprite = AGENT_SPRITE_IDS[Number(agentId)]
  return sprite ? `${ICON_GENERAL_BASE}${sprite}.webp` : undefined
}
