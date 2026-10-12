import type { Agent, Build, GameAccount, DriveDisc } from '@/types'

export const mockGameAccount: GameAccount = {
  id: 'acc-dev-1',
  uid: '1500888999',
  region: 'Europe',
  created_at: '2026-09-01T12:00:00Z',
}

function makeDisc(slot: number, setName: string, setId: number, mainPropName: string, mainPropVal: number | string, isPercent: boolean, sub1: string, sub2: string): DriveDisc {
  return {
    id: 3000 + slot,
    uid: `disc-slot-${slot}`,
    slot,
    level: 15,
    rarity: 'S',
    icon_path: '',
    set: {
      id: setId,
      name: setName,
    },
    main_stat: {
      property_id: 10000 + slot,
      name: mainPropName,
      value: typeof mainPropVal === 'number' ? mainPropVal : 0,
      is_percent: isPercent,
      rolls: 1,
      icon_url: '',
    },
    sub_stats: [
      { property_id: 20101, name: sub1, value: 0.048, is_percent: true, rolls: 3, icon_url: '' },
      { property_id: 21101, name: sub2, value: 0.096, is_percent: true, rolls: 2, icon_url: '' },
      { property_id: 12101, name: 'Сила атаки', value: 19, is_percent: false, rolls: 1, icon_url: '' },
      { property_id: 11101, name: 'HP', value: 112, is_percent: false, rolls: 1, icon_url: '' },
    ],
  }
}

export const mockEllenAgent: Agent = {
  id: 1191,
  name: 'Эллен',
  level: 60,
  promotion: 6,
  mindscape_cinema: 2,
  core_skill_enhancement: 6,
  rarity: 'S',
  attribute: 'Ice',
  attribute_name: 'Лед',
  specialty: 'Attack',
  specialty_name: 'Нападение',
  skin: null,
  splash_art_url: 'https://static.nanoka.cc/assets/zzz/IconRoleCircle21.webp',
  skills: [],
  w_engine: {
    id: 12001,
    uid: 'w-ellen-1',
    name: 'Глубоководный гость',
    rarity: 'S',
    level: 60,
    phase: 1,
    modification: 5,
    specialty: 'Attack',
    specialty_name: 'Нападение',
    icon_url: 'https://static.nanoka.cc/assets/zzz/weapon_12001.webp',
    main_stat: {
      property_id: 12101,
      name: 'Базовая сила атаки',
      value: 684,
      is_percent: false,
      rolls: 1,
      icon_url: '',
    },
    secondary_stat: {
      property_id: 20101,
      name: 'Крит. шанс',
      value: 0.24,
      is_percent: true,
      rolls: 1,
      icon_url: '',
    },
    passive_description: 'При попадании ледяной атакой увеличивает крит. шанс на 20% на 8 сек.',
  },
  drive_discs: {
    slots: [
      makeDisc(1, 'Полярный металл', 101, 'HP', 2200, false, 'Крит. шанс', 'Крит. урон'),
      makeDisc(2, 'Полярный металл', 101, 'Сила атаки', 316, false, 'Крит. шанс', 'Крит. урон'),
      makeDisc(3, 'Полярный металл', 101, 'Защита', 184, false, 'Крит. урон', 'Сила атаки %'),
      makeDisc(4, 'Полярный металл', 101, 'Крит. шанс', 0.24, true, 'Крит. урон', 'Сила атаки'),
      makeDisc(5, 'Дятел-электро', 102, 'Бонус ледяного урона', 0.30, true, 'Крит. шанс', 'Крит. урон'),
      makeDisc(6, 'Дятел-электро', 102, 'Сила атаки', 0.30, true, 'Крит. шанс', 'Крит. урон'),
    ],
    set_bonuses: [
      {
        set: { id: 101, name: 'Полярный металл' },
        count: 4,
        effects: [
          { piece_count: 2, description: 'Увеличивает ледяной урон на 10%', is_active: true },
          { piece_count: 4, description: 'Базовая атака и дэш наносят на 28% больше урона', is_active: true },
        ],
      },
      {
        set: { id: 102, name: 'Дятел-электро' },
        count: 2,
        effects: [
          { piece_count: 2, description: 'Увеличивает крит. шанс на 8%', is_active: true },
        ],
      },
    ],
  },
  ui_stats: {
    hp: { property_id: 11101, name: 'HP', total: '11 480', base: '7 820', added: '3 660', icon_url: '' },
    atk: { property_id: 12101, name: 'Сила атаки', total: '3 150', base: '984', added: '2 166', icon_url: '' },
    def: { property_id: 13101, name: 'Защита', total: '790', base: '610', added: '180', icon_url: '' },
    crit_rate: { property_id: 20101, name: 'Крит. шанс', total: '68.4%', base: '5.0%', added: '63.4%', icon_url: '' },
    crit_dmg: { property_id: 21101, name: 'Крит. урон', total: '172.8%', base: '50.0%', added: '122.8%', icon_url: '' },
    attribute_dmg_bonus: { property_id: 30101, name: 'Бонус лед. урона', total: '40.0%', base: '0%', added: '40.0%', icon_url: '' },
    pen_ratio: { property_id: 22101, name: 'Пробивание', total: '0.0%', base: '0%', added: '0%', icon_url: '' },
    anomaly_mastery: { property_id: 31101, name: 'Знание аномалии', total: '114', base: '94', added: '20', icon_url: '' },
    anomaly_proficiency: { property_id: 31201, name: 'Контроль аномалии', total: '95', base: '95', added: '0', icon_url: '' },
  },
}

export const mockEllenBuild: Build = {
  id: 'build-ellen-shark',
  game_account_id: mockGameAccount.id,
  agent_id: mockEllenAgent.id,
  agent_name: mockEllenAgent.name,
  name: 'Shark Frostbite (Main)',
  description: 'Максимальный крит. урон под ледяной сетап с Ликаоном и Сокаку',
  weapon_uid: 'w-ellen-1',
  weapon_id: 12001,
  disc_uids: ['disc-slot-1', 'disc-slot-2', 'disc-slot-3', 'disc-slot-4', 'disc-slot-5', 'disc-slot-6'],
  build_data: mockEllenAgent,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-28T18:30:00Z',
}

export const mockJaneAgent: Agent = {
  id: 1261,
  name: 'Джейн Доу',
  level: 60,
  promotion: 6,
  mindscape_cinema: 1,
  core_skill_enhancement: 6,
  rarity: 'S',
  attribute: 'Physical',
  attribute_name: 'Физический',
  specialty: 'Anomaly',
  specialty_name: 'Аномалия',
  skin: null,
  splash_art_url: 'https://static.nanoka.cc/assets/zzz/IconRoleCircle24.webp',
  skills: [],
  w_engine: {
    id: 12003,
    uid: 'w-jane-1',
    name: 'Заточенное жало',
    rarity: 'S',
    level: 60,
    phase: 1,
    modification: 5,
    specialty: 'Anomaly',
    specialty_name: 'Аномалия',
    icon_url: '',
    main_stat: { property_id: 12101, name: 'Базовая сила атаки', value: 713, is_percent: false, rolls: 1, icon_url: '' },
    secondary_stat: { property_id: 31201, name: 'Контроль аномалии', value: 90, is_percent: false, rolls: 1, icon_url: '' },
    passive_description: 'Повышает физ. урон при накоплении страсти.',
  },
  drive_discs: {
    slots: [
      makeDisc(1, 'Клыкастый металл', 103, 'HP', 2200, false, 'Знание аномалии', 'Сила атаки %'),
      makeDisc(2, 'Клыкастый металл', 103, 'Сила атаки', 316, false, 'Контроль аномалии', 'Сила атаки %'),
      makeDisc(3, 'Клыкастый металл', 103, 'Защита', 184, false, 'Знание аномалии', 'Крит. шанс'),
      makeDisc(4, 'Клыкастый металл', 103, 'Контроль аномалии', 92, false, 'Сила атаки %', 'Знание аномалии'),
      makeDisc(5, 'Блюз свободы', 104, 'Физ. урон %', 0.30, true, 'Сила атаки', 'Контроль аномалии'),
      makeDisc(6, 'Блюз свободы', 104, 'Знание аномалии', 0.30, true, 'Сила атаки', 'Контроль аномалии'),
    ],
    set_bonuses: [
      {
        set: { id: 103, name: 'Клыкастый металл' },
        count: 4,
        effects: [{ piece_count: 4, description: 'Увеличивает физ. урон при наложении натиска', is_active: true }],
      },
    ],
  },
}

export const mockJaneBuild: Build = {
  id: 'build-jane-anomaly',
  game_account_id: mockGameAccount.id,
  agent_id: mockJaneAgent.id,
  agent_name: mockJaneAgent.name,
  name: 'Passion Assault',
  description: 'Физический билд под чистый Натиск и гиперкерри соло-ротацию',
  weapon_uid: 'w-jane-1',
  weapon_id: 12003,
  disc_uids: [],
  build_data: mockJaneAgent,
  created_at: '2026-09-22T14:10:00Z',
  updated_at: '2026-09-29T12:00:00Z',
}

export const mockCorinAgent: Agent = {
  id: 1061,
  name: 'Корин',
  level: 50,
  promotion: 5,
  mindscape_cinema: 6,
  core_skill_enhancement: 4,
  rarity: 'A',
  attribute: 'Physical',
  attribute_name: 'Физический',
  specialty: 'Attack',
  specialty_name: 'Нападение',
  skin: null,
  splash_art_url: 'https://static.nanoka.cc/assets/zzz/IconRoleCircle09.webp',
  skills: [],
  w_engine: {
    id: 12001,
    uid: 'w-ellen-1', // Shared weapon UID to demonstrate weapon collision!
    name: 'Глубоководный гость (Занят)',
    rarity: 'S',
    level: 60,
    phase: 1,
    modification: 5,
    specialty: 'Attack',
    specialty_name: 'Нападение',
    icon_url: 'https://static.nanoka.cc/assets/zzz/weapon_12001.webp',
    main_stat: { property_id: 12101, name: 'Базовая атака', value: 684, is_percent: false, rolls: 1, icon_url: '' },
    secondary_stat: { property_id: 20101, name: 'Крит. шанс', value: 0.24, is_percent: true, rolls: 1, icon_url: '' },
    passive_description: '',
  },
}

export const mockCorinBuild: Build = {
  id: 'build-corin-saw',
  game_account_id: mockGameAccount.id,
  agent_id: mockCorinAgent.id,
  agent_name: mockCorinAgent.name,
  name: 'Housekeeper Chainsaw',
  description: 'Бурст по оглушенным целям через E-skill',
  weapon_uid: 'w-ellen-1', // Conflict with Ellen!
  weapon_id: 12001,
  disc_uids: ['disc-slot-1'], // Conflict with Ellen disc 1!
  build_data: mockCorinAgent,
  created_at: '2026-09-21T18:00:00Z',
  updated_at: '2026-09-25T11:00:00Z',
}

export const mockEllenAltBuild: Build = {
  id: 'build-ellen-alt',
  game_account_id: mockGameAccount.id,
  agent_id: mockEllenAgent.id,
  agent_name: mockEllenAgent.name,
  name: 'Ice Slasher (Sub-DPS)',
  description: 'Альтернативный сетап под быструю ротацию и дэши',
  weapon_uid: 'w-ellen-alt-1',
  weapon_id: 11001,
  disc_uids: [],
  build_data: {
    ...mockEllenAgent,
    w_engine: {
      id: 11001,
      uid: 'w-ellen-alt-1',
      name: 'Двигатель звездопада',
      rarity: 'A',
      level: 60,
      phase: 1,
      modification: 1,
      specialty: 'Attack',
      specialty_name: 'Нападение',
      icon_url: 'https://static.nanoka.cc/assets/zzz/weapon_11001.webp',
      main_stat: { property_id: 12101, name: 'Базовая атака', value: 594, is_percent: false, rolls: 1, icon_url: '' },
      secondary_stat: { property_id: 12102, name: 'Сила атаки %', value: 0.20, is_percent: true, rolls: 1, icon_url: '' },
      passive_description: '',
    },
  },
  created_at: '2026-09-22T11:00:00Z',
  updated_at: '2026-09-28T12:00:00Z',
}

export const mockMiyabiAgent: Agent = {
  id: 1091,
  name: 'Хосими Мияби',
  level: 60,
  promotion: 6,
  mindscape_cinema: 0,
  core_skill_enhancement: 6,
  rarity: 'S',
  attribute: 'Frost',
  attribute_name: 'Лед',
  specialty: 'Anomaly',
  specialty_name: 'Аномалия',
  skin: null,
  splash_art_url: 'https://static.nanoka.cc/assets/zzz/IconRoleCircle13.webp',
  skills: [],
  w_engine: null,
}

export const mockMiyabiBuild: Build = {
  id: 'build-miyabi-frost',
  game_account_id: mockGameAccount.id,
  agent_id: mockMiyabiAgent.id,
  agent_name: mockMiyabiAgent.name,
  name: 'Frost Blade Flurry',
  description: 'Быстрые комбо и рассекающие удары',
  weapon_uid: null,
  weapon_id: null,
  disc_uids: [],
  build_data: mockMiyabiAgent,
  created_at: '2026-09-27T08:00:00Z',
  updated_at: '2026-09-30T10:00:00Z',
}

export const mockAllBuilds: Build[] = [
  mockEllenBuild,
  mockEllenAltBuild,
  mockJaneBuild,
  mockCorinBuild,
  mockMiyabiBuild,
]
