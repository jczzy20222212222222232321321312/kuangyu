/* ORE.ZONE UI localization.
   The game source strings are Chinese; this layer translates static and
   dynamically rendered DOM text plus the canvas faction/unit labels. */
(function () {
  'use strict';
  const ORE = (window.ORE = window.ORE || {});
  const LANGS = [
    ['en', 'English', 'EN'],
    ['zh-Hant', '中文（繁體）', '繁'],
    ['fr', 'Français', 'FR'],
    ['ru', 'Русский', 'RU'],
    ['ja', '日本語', '日'],
    ['ko', '한국어', '한'],
    ['vi', 'Tiếng Việt', 'VI'],
    ['ar', 'العربية', 'ع'],
  ];
  const ORDER = ['en', 'zh-Hant', 'fr', 'ru', 'ja', 'ko', 'vi', 'ar'];

  // source, English, Traditional Chinese, French, Russian, Japanese, Korean, Vietnamese, Arabic
  const ROWS = [
    ['矿域', 'ORE.ZONE', '礦域', 'ORE.ZONE', 'ORE.ZONE', 'ORE.ZONE', 'ORE.ZONE', 'ORE.ZONE', 'ORE.ZONE'],
    ['矿池 --', 'Pool --', '礦池 --', 'Pool --', 'Пул --', 'プール --', '풀 --', 'Pool --', 'البركة --'],
    ['总兵', 'Troops', '總兵', 'Troupes', 'Войска', '総兵力', '총병력', 'Tổng quân', 'القوات'],
    ['总战力', 'Power', '總戰力', 'Puissance', 'Сила', '総戦力', '총전력', 'Sức mạnh', 'القوة'],
    ['矿池剩余', 'Pool Left', '礦池剩餘', 'Pool restant', 'Остаток пула', 'プール残り', '풀 잔여', 'Pool còn lại', 'المتبقي في البركة'],
    ['个人钱包', 'Personal Wallet', '個人錢包', 'Portefeuille personnel', 'Личный кошелёк', '個人ウォレット', '개인 지갑', 'Ví cá nhân', 'المحفظة الشخصية'],
    ['钱包 ETH', 'Wallet ETH', '錢包 ETH', 'Portefeuille ETH', 'Кошелёк ETH', 'ウォレット ETH', '지갑 ETH', 'Ví ETH', 'محفظة ETH'],
    ['LP 份额', 'LP Share', 'LP 份額', 'Part LP', 'Доля LP', 'LP シェア', 'LP 지분', 'Phần LP', 'حصة LP'],
    ['总兵力', 'Troops', '總兵力', 'Effectif', 'Численность', '総兵力', '총병력', 'Tổng lực lượng', 'القوات'],
    ['在役', 'Active', '在役', 'Actifs', 'В строю', '現役', '현역', 'Đang phục vụ', 'في الخدمة'],
    ['阵亡', 'Dead', '陣亡', 'Morts', 'Павшие', '戦死', '전사', 'Tử trận', 'قتلى'],
    ['复活', 'Revive', '復活', 'Retour', 'Возврат', '復活', '부활', 'Hồi sinh', 'إحياء'],
    ['军团', 'Army', '軍團', 'Armée', 'Армия', '軍団', '군단', 'Quân đoàn', 'الجيش'],
    ['婚育', 'Breeding', '婚育', 'Reproduction', 'Разведение', '結婚・繁殖', '혼인·번식', 'Hôn nhân·Sinh sản', 'الزواج والإنجاب'],
    ['市场', 'Market', '市場', 'Marché', 'Рынок', 'マーケット', '시장', 'Chợ', 'السوق'],
    ['经济', 'Economy', '經濟', 'Économie', 'Экономика', '経済', '경제', 'Kinh tế', 'الاقتصاد'],
    ['战报', 'War Feed', '戰報', 'Journal', 'Сводка', '戦報', '전황', 'Báo trận', 'تقرير الحرب'],
    ['作战手册', 'Field Manual', '作戰手冊', 'Manuel', 'Полевое руководство', '作戦マニュアル', '작전 매뉴얼', 'Sổ tay', 'دليل القتال'],
    ['设置', 'Settings', '設定', 'Réglages', 'Настройки', '設定', '설정', 'Cài đặt', 'الإعدادات'],
    ['音效开关', 'Sound', '音效開關', 'Son', 'Звук', 'サウンド', '사운드', 'Âm thanh', 'الصوت'],
    ['连接钱包', 'Connect Wallet', '連接錢包', 'Connecter', 'Подключить', 'ウォレット接続', '지갑 연결', 'Kết nối ví', 'ربط المحفظة'],
    ['全局矿池剩余', 'Global Pool Left', '全域礦池剩餘', 'Pool global restant', 'Глобальный остаток', '全体プール残り', '전체 풀 잔여', 'Pool toàn cầu còn lại', 'المتبقي العالمي'],
    ['每日产出剩余矿池的 1%', '1% of remaining pool daily', '每日產出剩餘礦池的 1%', '1 % du pool restant/jour', '1% остатка пула в день', '残りプールの1%を毎日', '매일 남은 풀의 1%', '1% pool còn lại mỗi ngày', '1% من البركة المتبقية يوميًا'],
    ['烧兵提取', 'Burn & Withdraw', '燒兵提取', 'Brûler & retirer', 'Сжечь и вывести', '焼却して引出', '소각 후 인출', 'Đốt & Rút', 'حرق وسحب'],
    ['点击地图上的地块，查看矿脉与战况。', 'Click a tile to inspect the mine and battle.', '點擊地圖上的地塊，查看礦脈與戰況。', 'Cliquez sur une parcelle pour voir la mine et les combats.', 'Нажмите на участок, чтобы увидеть руду и бой.', 'マップの区画をクリックして鉱脈と戦況を確認。', '지도 타일을 클릭해 광맥과 전황을 확인하세요.', 'Nhấp vào ô đất để xem mỏ và chiến sự.', 'انقر على قطعة أرض لعرض المنجم والمعركة.'],
    ['势力控制', 'Faction Control', '勢力控制', 'Contrôle', 'Контроль фракций', '勢力支配', '세력 통제', 'Kiểm soát thế lực', 'السيطرة على الفصائل'],
    ['地块 / 产出', 'Tiles / Output', '地塊 / 產出', 'Parcelles / Production', 'Участки / Добыча', '区画 / 生産', '타일 / 생산', 'Ô đất / Sản lượng', 'القطع / الإنتاج'],
    ['中立之地', 'Neutral Land', '中立之地', 'Terre neutre', 'Нейтральная земля', '中立の地', '중립지', 'Đất trung lập', 'أرض محايدة'],
    ['产出', 'Output', '產出', 'Production', 'Добыча', '生産', '생산', 'Sản lượng', 'الإنتاج'],
    ['防御', 'Defense', '防禦', 'Défense', 'Защита', '防御', '방어', 'Phòng thủ', 'الدفاع'],
    ['驻军', 'Garrison', '駐軍', 'Garnison', 'Гарнизон', '駐屯', '주둔', 'Đồn trú', 'الحامية'],
    ['民兵', 'Militia', '民兵', 'Milice', 'Ополчение', '民兵', '민병', 'Dân quân', 'ميليشيا'],
    ['返回', 'Back', '返回', 'Retour', 'Назад', '戻る', '뒤로', 'Quay lại', 'رجوع'],
    ['突袭', 'Raid', '突襲', 'Raid', 'Рейд', '奇襲', '기습', 'Đột kích', 'غارة'],
    ['发动突袭', 'Launch Raid', '發動突襲', 'Lancer le raid', 'Начать рейд', '奇襲開始', '기습 시작', 'Phát động đột kích', 'شن الغارة'],
    ['够赢即可', 'Just Enough to Win', '夠贏即可', 'Juste pour gagner', 'Достаточно для победы', '勝てる分だけ', '이길 만큼만', 'Đủ để thắng', 'يكفي للفوز'],
    ['全部', 'All', '全部', 'Tout', 'Все', '全部', '전부', 'Tất cả', 'الكل'],
    ['收起', 'Collapse', '收起', 'Replier', 'Свернуть', '閉じる', '접기', 'Thu gọn', 'طي'],
    ['确认', 'Confirm', '確認', 'Confirmer', 'Подтвердить', '確認', '확인', 'Xác nhận', 'تأكيد'],
    ['关闭', 'Close', '關閉', 'Fermer', 'Закрыть', '閉じる', '닫기', 'Đóng', 'إغلاق'],
    ['取消', 'Cancel', '取消', 'Annuler', 'Отмена', 'キャンセル', '취소', 'Hủy', 'إلغاء'],
    ['下一步', 'Next', '下一步', 'Suivant', 'Далее', '次へ', '다음', 'Tiếp', 'التالي'],
    ['跳过', 'Skip', '跳過', 'Passer', 'Пропустить', 'スキップ', '건너뛰기', 'Bỏ qua', 'تخطي'],
    ['确认入伍', 'Confirm Enlistment', '確認入伍', 'Confirmer l\'engagement', 'Подтвердить вступление', '入伍確認', '입대 확인', 'Xác nhận nhập ngũ', 'تأكيد التجنيد'],
    ['入伍', 'Enlist', '入伍', 'S\'engager', 'Вступить', '入伍', '입대', 'Nhập ngũ', 'تجنيد'],
    ['再想想', 'Not Yet', '再想想', 'Pas encore', 'Позже', 'やめる', '다시 생각', 'Suy nghĩ lại', 'لاحقًا'],
    ['先选择一个势力入伍', 'Choose a faction to enlist first', '先選擇一個勢力入伍', 'Choisissez d\'abord une faction', 'Сначала выберите фракцию', 'まず勢力を選択', '먼저 세력을 선택하세요', 'Chọn thế lực trước', 'اختر فصيلًا أولًا'],
    ['三族争矿。', 'Three kingdoms fight for ore.', '三族爭礦。', 'Trois royaumes se disputent le minerai.', 'Три королевства сражаются за руду.', '三勢力が鉱脈を争う。', '세 세력이 광맥을 다툰다.', 'Ba vương quốc tranh mỏ.', 'ثلاث ممالك تتنافس على الخام.'],
    ['链上为兵。', 'On-chain armies.', '鏈上為兵。', 'Des armées on-chain.', 'Армии в сети.', 'オンチェーンの兵。', '온체인 군대.', 'Quân đội trên chuỗi.', 'جيوش على السلسلة.'],
    ['烧兵取矿。', 'Burn soldiers for ore.', '燒兵取礦。', 'Brûlez des soldats pour le minerai.', 'Сжигайте солдат ради руды.', '兵を焼いて鉱石に。', '병사를 태워 광석을 얻는다.', 'Đốt lính để lấy mỏ.', 'احرق الجنود للحصول على الخام.'],
    ['作战手册 · 经济怎么转', 'Field Manual · How the economy works', '作戰手冊 · 經濟怎麼轉', 'Manuel · Comment fonctionne l\'économie', 'Руководство · Как работает экономика', '作戦マニュアル · 経済の仕組み', '작전 매뉴얼 · 경제 구조', 'Sổ tay · Kinh tế vận hành thế nào', 'دليل القتال · كيف يعمل الاقتصاد'],
    ['GENESIS · 链上士兵', 'GENESIS · On-chain soldiers', 'GENESIS · 鏈上士兵', 'GENESIS · Soldats on-chain', 'GENESIS · Солдаты в сети', 'GENESIS · オンチェーン兵', 'GENESIS · 온체인 병사', 'GENESIS · Lính trên chuỗi', 'GENESIS · جنود على السلسلة'],
    ['总量 100,000,000', 'Total 100,000,000', '總量 100,000,000', 'Total 100 000 000', 'Всего 100 000 000', '総量 100,000,000', '총량 100,000,000', 'Tổng 100.000.000', 'الإجمالي 100,000,000'],
    ['南极王国', 'Antarctic Kingdom', '南極王國', 'Royaume antarctique', 'Антарктическое королевство', '南極王国', '남극 왕국', 'Vương quốc Nam Cực', 'المملكة القطبية الجنوبية'],
    ['森林王国', 'Forest Kingdom', '森林王國', 'Royaume de la forêt', 'Лесное королевство', '森林王国', '숲 왕국', 'Vương quốc Rừng', 'مملكة الغابة'],
    ['沙漠王国', 'Desert Kingdom', '沙漠王國', 'Royaume du désert', 'Пустынное королевство', '砂漠王国', '사막 왕국', 'Vương quốc Sa mạc', 'مملكة الصحراء'],
    ['盾卫', 'Guard', '盾衛', 'Garde', 'Стражник', '盾衛', '방패병', 'Vệ binh', 'حارس'],
    ['先锋', 'Vanguard', '先鋒', 'Avant-garde', 'Авангард', '先鋒', '선봉', 'Tiên phong', 'طليعة'],
    ['弓手', 'Archer', '弓手', 'Archer', 'Лучник', '弓兵', '궁수', 'Cung thủ', 'رامي'],
    ['术士', 'Warlock', '術士', 'Sorcier', 'Колдун', '術士', '술사', 'Thuật sĩ', 'ساحر'],
    ['游骑', 'Raider', '遊騎', 'Cavalier', 'Рейдер', '遊騎', '기병', 'Kỵ binh', 'فارس'],
    ['新兵', 'Recruit', '新兵', 'Recrue', 'Новобранец', '新兵', '신병', 'Tân binh', 'مجند'],
    ['老兵', 'Veteran', '老兵', 'Vétéran', 'Ветеран', '古参兵', '고참병', 'Cựu binh', 'محارب قديم'],
    ['精锐', 'Captain', '精銳', 'Capitaine', 'Капитан', '精鋭', '정예', 'Tinh nhuệ', 'نخبة'],
    ['统领', 'Warlord', '統領', 'Seigneur', 'Военачальник', '統領', '군주', 'Thống lĩnh', 'قائد'],
    ['传奇', 'Genesis', '傳奇', 'Légende', 'Легенда', '伝説', '전설', 'Huyền thoại', 'أسطورة'],
    ['攻击 +10%', 'ATK +10%', '攻擊 +10%', 'ATQ +10%', 'АТК +10%', '攻撃 +10%', '공격 +10%', 'Tấn công +10%', 'الهجوم +10%'],
    ['守御 +12%', 'DEF +12%', '守禦 +12%', 'DÉF +12%', 'ЗАЩ +12%', '防御 +12%', '방어 +12%', 'Phòng thủ +12%', 'الدفاع +12%'],
    ['提取 +12%', 'EXTRACT +12%', '提取 +12%', 'EXTRACTION +12%', 'ДОБЫЧА +12%', '抽出 +12%', '추출 +12%', 'Rút +12%', 'السحب +12%'],
    ['已铸造', 'Minted', '已鑄造', 'Frappé', 'Выпущено', '鋳造済み', '주조됨', 'Đã đúc', 'تم السك'],
    ['铸造士兵 · BSC 测试网（已铸造', 'Mint · BSC Testnet (Minted', '鑄造士兵 · BSC 測試網（已鑄造', 'Frapper des soldats · BSC Testnet (Frappé', 'Выпуск солдат · BSC Testnet (Выпущено', '兵を鋳造 · BSCテストネット（鋳造済み', '병사 주조 · BSC 테스트넷 (주조됨', 'Đúc lính · BSC Testnet (Đã đúc', 'سك الجنود · BSC Testnet (تم السك'],
    ['BSC Testnet 钱包读取军团 · 进度自动保存在本地', 'BSC Testnet wallet reads your army · progress saved locally', 'BSC Testnet 錢包讀取軍團 · 進度自動保存在本地', 'Le portefeuille BSC Testnet lit votre armée · progression sauvegardée localement', 'Кошелёк BSC Testnet читает армию · прогресс сохраняется локально', 'BSC Testnetウォレットが軍団を読み取り · 進行はローカル保存', 'BSC Testnet 지갑이 군단을 읽음 · 진행은 로컬 저장', 'Ví BSC Testnet đọc quân đoàn · tiến trình lưu cục bộ', 'محفظة BSC Testnet تقرأ جيشك · يتم حفظ التقدم محليًا'],
    ['战力', 'Power', '戰力', 'Puissance', 'Сила', '戦力', '전력', 'Sức mạnh', 'القوة'],
    ['矿块', 'Tiles', '礦塊', 'Parcelles', 'Участки', '区画', '타일', 'Ô đất', 'قطع'],
    ['基地', 'Base', '基地', 'Base', 'База', '基地', '기지', 'Căn cứ', 'قاعدة'],
    ['专属加成', 'Faction Bonus', '專屬加成', 'Bonus de faction', 'Бонус фракции', '専用ボーナス', '전용 보너스', 'Thưởng thế lực', 'مكافأة الفصيل'],
    ['初始军团', 'Starting Army', '初始軍團', 'Armée initiale', 'Стартовая армия', '初期軍団', '초기 군단', 'Quân đoàn ban đầu', 'الجيش الأولي'],
    ['由链上 NFT 决定', 'Determined by on-chain NFTs', '由鏈上 NFT 決定', 'Déterminé par les NFT on-chain', 'Определяется NFT в сети', 'オンチェーンNFTで決定', '온체인 NFT로 결정', 'Do NFT trên chuỗi quyết định', 'يحدده NFT على السلسلة'],
    ['起始地块', 'Starting Tiles', '起始地塊', 'Parcelles initiales', 'Стартовые участки', '初期区画', '초기 타일', 'Ô đất ban đầu', 'القطع الأولية'],
    ['起始 ETH', 'Starting ETH', '起始 ETH', 'ETH initial', 'Стартовый ETH', '初期 ETH', '초기 ETH', 'ETH ban đầu', 'ETH الأولي'],
    ['加入后不可更换势力。地图会被 AI 势力同步争夺。', 'You cannot change faction after joining. AI factions compete for the map.', '加入後不可更換勢力。地圖會被 AI 勢力同步爭奪。', 'Impossible de changer de faction après l\'engagement. Les factions IA se disputent la carte.', 'После вступления нельзя сменить фракцию. Фракции ИИ борются за карту.', '加入後は勢力を変更できません。AI勢力も地図を争います。', '가입 후 세력을 변경할 수 없습니다. AI 세력도 지도를 두고 경쟁합니다.', 'Không thể đổi thế lực sau khi tham gia. Các thế lực AI cũng tranh bản đồ.', 'لا يمكن تغيير الفصيل بعد الانضمام. فصائل الذكاء الاصطناعي تتنافس على الخريطة.'],
    ['以 ', 'As ', '以 ', 'Au nom de ', 'От имени ', '「', '이름으로 ', 'Nhân danh ', 'باسم '],
    ['之名', '', '之名', '', '', '」', '', '', ''],
    ['南极冰海上的王国。蓝冰为城，深海为壕，守住极昼下的最后一道冰墙。', 'A kingdom on the Antarctic ice sea. Blue ice for walls, deep sea for moats, guarding the last ice wall under the midnight sun.', '南極冰海上的王國。藍冰為城，深海為壕，守住極晝下的最後一道冰牆。', 'Un royaume sur la mer de glace antarctique. Glace bleue pour murs, mer profonde pour douves.', 'Королевство на антарктическом ледяном море. Голубой лёд — стены, глубина — рвы.', '南極の氷海の王国。青い氷を城壁に、深海を堀に。', '남극 얼음 바다의 왕국. 푸른 얼음을 성벽으로, 깊은 바다를 해자로.', 'Vương quốc trên biển băng Nam Cực. Băng xanh làm thành, biển sâu làm hào.', 'مملكة على بحر الجليد القطبي. الجليد الأزرق أسوار والبحر العميق خنادق.'],
    ['巨木与藤蔓之下的森林王国。每一棵古树都是一座瞭望塔。', 'A forest kingdom beneath giant trees and vines. Every ancient tree is a watchtower.', '巨木與藤蔓之下的森林王國。每一棵古樹都是一座瞭望塔。', 'Un royaume forestier sous les arbres géants et les lianes. Chaque arbre ancien est une tour de guet.', 'Лесное королевство под гигантскими деревьями и лианами. Каждое древнее дерево — сторожевая башня.', '巨木と蔓の下の森林王国。すべての古木が望楼。', '거목과 덩굴 아래의 숲 왕국. 모든 고목이 망루입니다.', 'Vương quốc rừng dưới cây khổng lồ và dây leo. Mỗi cổ thụ là một tháp canh.', 'مملكة غابة تحت الأشجار العملاقة والكروم. كل شجرة قديمة برج مراقبة.'],
    ['金色沙海与土山之间的商队王国。风把城墙磨成沙，也把矿脉吹到地表。', 'A caravan kingdom between golden sand seas and earthen mountains. Wind grinds walls to sand and exposes ore veins.', '金色沙海與土山之間的商隊王國。風把城牆磨成沙，也把礦脈吹到地表。', 'Un royaume de caravanes entre mers de sable doré et montagnes de terre. Le vent polit les murs et révèle les filons.', 'Королевство караванов между золотыми песками и земляными горами. Ветер точит стены и обнажает руду.', '金色の砂海と土山の間の隊商王国。風が城壁を砂にし、鉱脈を露出させる。', '황금 사막과 흙산 사이의 대상 왕국. 바람이 성벽을 모래로 만들고 광맥을 드러냅니다.', 'Vương quốc thương đoàn giữa biển cát vàng và núi đất. Gió mài thành cát và lộ mỏ.', 'مملكة قوافل بين بحار الرمل الذهبي والجبال الترابية. الريح تطحن الأسوار وتكشف العروق.'],
    ['欢迎来到矿域', 'Welcome to ORE.ZONE', '歡迎來到礦域', 'Bienvenue dans ORE.ZONE', 'Добро пожаловать в ORE.ZONE', 'ORE.ZONEへようこそ', 'ORE.ZONE에 오신 것을 환영합니다', 'Chào mừng đến ORE.ZONE', 'مرحبًا بك في ORE.ZONE'],
    ['四个动作，理解整个经济循环。', 'Four actions to understand the whole economy.', '四個動作，理解整個經濟循環。', 'Quatre actions pour comprendre toute l\'économie.', 'Четыре действия, чтобы понять всю экономику.', '4つの動作で経済全体を理解。', '네 가지 행동으로 경제 전체를 이해하세요.', 'Bốn thao tác để hiểu toàn bộ kinh tế.', 'أربع خطوات لفهم الاقتصاد بالكامل.'],
    ['地块每分钟产出 ORE。军团不白送：连接 BSC Testnet 钱包，持有几个士兵 NFT，游戏里才有几个士兵。士兵既是战斗力，也是提取权。', 'Every tile produces ORE each minute. Armies are not free: connect a BSC Testnet wallet and hold soldier NFTs — that is how many soldiers you command. Soldiers are both combat power and withdrawal rights.', '地塊每分鐘產出 ORE。軍團不白送：連接 BSC Testnet 錢包，持有幾個士兵 NFT，遊戲裡才有幾個士兵。士兵既是戰鬥力，也是提取權。', 'Chaque parcelle produit des ORE par minute. L\'armée n\'est pas gratuite : connectez un portefeuille BSC Testnet et détenez des NFT de soldats — leur nombre détermine vos soldats. Ils sont à la fois force de combat et droit de retrait.', 'Каждый участок добывает ORE в минуту. Армия не бесплатна: подключите кошелёк BSC Testnet и держите NFT солдат — столько солдат у вас и будет. Солдаты — это и сила, и право на вывод.', '各區画は毎分OREを産出。軍団は無料ではありません。BSC Testnetウォレットを接続し、兵士NFTを保有した数だけゲーム内に兵士がいます。兵士は戦力であり、引出権でもあります。', '각 타일은 분마다 ORE를 생산합니다. 군단은 무료가 아닙니다. BSC Testnet 지갑을 연결하고 보유한 병사 NFT 수만큼 게임에 병사가 있습니다. 병사는 전투력이자 인출 권한입니다.', 'Mỗi ô đất sản xuất ORE mỗi phút. Quân đoàn không miễn phí: kết nối ví BSC Testnet và sở hữu NFT lính — bạn có bấy nhiêu lính. Lính vừa là sức chiến đấu vừa là quyền rút.', 'كل قطعة تنتج ORE كل دقيقة. الجيش ليس مجانيًا: اربط محفظة BSC Testnet واحتفظ بـ NFT الجنود — بعددها يكون جنودك. الجنود قوة قتالية وحق سحب.'],
    ['矿块·1基地', ' Tiles · 1 Base', '礦塊·1基地', ' parcelles · 1 base', ' участков · 1 база', ' 区画 · 1基地', ' 타일 · 기지 1', ' ô đất · 1 căn cứ', ' قطع · قاعدة واحدة'],
    ['矿池', 'Pool', '礦池', 'Pool', 'Пул', 'プール', '풀', 'Pool', 'البركة'],
    ['地块每分钟产出', 'Each tile produces', '地塊每分鐘產出', 'Chaque parcelle produit', 'Каждый участок добывает', '各タイルは毎分', '각 타일은 매분', 'Mỗi ô đất sản xuất', 'كل قطعة تنتج'],
    ['。军团不白送：连接 BSC Testnet 钱包，持有几个士兵 NFT，游戏里才有几个士兵。士兵既是战斗力，也是提取权。', '. Armies are not free: connect a BSC Testnet wallet and hold soldier NFTs — that is how many soldiers you command. Soldiers are both combat power and withdrawal rights.', '。軍團不白送：連接 BSC Testnet 錢包，持有幾個士兵 NFT，遊戲裡才有幾個士兵。士兵既是戰鬥力，也是提取權。', '. L\'armée n\'est pas gratuite : connectez un portefeuille BSC Testnet et détenez des NFT de soldats — leur nombre détermine vos soldats. Ils sont à la fois force de combat et droit de retrait.', '. Армия не бесплатна: подключите кошелёк BSC Testnet и держите NFT солдат — столько солдат у вас и будет. Солдаты — это и сила, и право на вывод.', '。軍団は無料ではありません。BSC Testnetウォレットを接続し、兵士NFTを保有した数だけ兵士がいます。兵士は戦力であり、引出権でもあります。', '. 군단은 무료가 아닙니다. BSC Testnet 지갑을 연결하고 병사 NFT를 보유한 수만큼 병사가 있습니다. 병사는 전투력이자 인출 권한입니다.', '. Quân đoàn không miễn phí: kết nối ví BSC Testnet và sở hữu NFT lính — bạn có bấy nhiêu lính. Lính vừa là sức chiến đấu vừa là quyền rút.', '. الجيش ليس مجانيًا: اربط محفظة BSC Testnet واحتفظ بـ NFT الجنود — بعددها يكون جنودك. الجنود قوة قتالية وحق سحب.'],
    [' / 分', ' / min', ' / 分', ' / min', ' / мин', ' / 分', ' / 분', ' / phút', ' / دقيقة'],
    ['领先', ' Leading', ' 領先', ' En tête', ' Лидирует', ' リード', ' 선두', ' Dẫn đầu', ' متقدم'],
    ['不可攻击', ' Unattackable', '不可攻擊', ' Inattaquable', ' Неатакуемая', ' 攻撃不可', ' 공격 불가', ' Không thể tấn công', ' غير قابلة للهجوم'],
    ['三族陈兵，', 'Three factions mass their armies,', '三族陳兵，', 'Trois factions massent leurs armées,', 'Три фракции стягивают армии,', '三勢力が軍を集め、', '세 세력이 군대를 모으고,', 'Ba thế lực tập trung quân,', 'ثلاث فصائل تحشد جيوشها،'],
    ['三座基地', 'three bases ', '三座基地', 'trois bases ', 'три базы ', '3つの基地 ', '세 기지 ', 'ba căn cứ ', 'ثلاث قواعد '],
    ['在球面上互相等距。', 'equally spaced on the sphere.', '在球面上互相等距。', 'équidistantes sur la sphère.', 'равноудалены на сфере.', '球面上で等間隔。', '구면에 등간격으로.', 'cách đều trên mặt cầu.', 'متساوية التباعد على الكرة.'],
    ['链上军团尚未召唤：连接 ', 'On-chain army not summoned: connect ', '鏈上軍團尚未召喚：連接 ', 'Armée on-chain non invoquée : connectez ', 'Армия в сети не призвана: подключите ', 'オンチェーン軍団は未召喚：接続 ', '온체인 군단 미소환: 연결 ', 'Quân đoàn trên chuỗi chưa triệu hồi: kết nối ', 'الجيش على السلسلة لم يُستدعَ: اربط '],
    ['钱包，铸造 NFT 后士兵才会进入游戏。', ' wallet and mint an NFT; soldiers enter the game only then.', '錢包，鑄造 NFT 後士兵才會進入遊戲。', ' portefeuille et frappez un NFT ; les soldats n\'entrent qu\'ensuite.', ' кошелёк и выпустите NFT; только тогда солдаты войдут в игру.', 'ウォレットでNFTを鋳造すると兵士が参戦します。', ' 지갑에서 NFT를 주조해야 병사가 게임에 들어옵니다.', ' ví và đúc NFT thì lính mới vào game.', ' المحفظة واسك NFT ليتمكن الجنود من الدخول.'],
    ['地块', ' Tiles', ' 地塊', ' parcelles', ' участков', ' 区画', ' 타일', ' ô đất', ' قطع'],
    ['第 1 纪元', 'Era 1'],
    ['总量', 'Total'],
    ['今日', 'Today'],
    ['每日', 'Daily'],
    ['剩余', 'left'],
    ['士兵口袋', 'Soldier pockets'],
    ['每日产出剩余1% · 士兵口袋', 'Daily output left 1% · Soldier pockets'],
    ['链上 Tx：—（烧兵 / 提取 ORE 后显示 BscScan 记录）', 'On-chain Tx: — (shown after burn / ORE withdrawal)'],
    ['待命', 'Idle'],
    ['驻防', 'Garrison'],
    ['行军', 'Marching'],
    ['育中', 'Pregnant'],
    ['已占矿脉', 'Tiles held'],
    ['占已占矿脉', 'Held'],
    ['当前', 'Current'],
    ['为', 'is'],
    ['连接右上角', 'Connect the top-right'],
    ['免费铸造士兵', 'mint soldiers free'],
    ['同步', 'Sync'],
    ['链上有几个 NFT 就有几个士兵', 'one soldier per NFT on-chain'],
    ['两族', 'Two AI factions'],
    ['各', 'each'],
    ['你的', 'Your'],
    ['由', 'determined by'],
    ['接管了', 'took over'],
    ['军饷', 'stipend'],
    ['后自动召唤', 'auto-summon after minting'],
    ['作战简报', 'Field Brief'],
    ['BRIEFING · 作战简报', 'BRIEFING · Field Brief'],
    ['远离基地 · 高产', 'Away from base · High yield'],
    ['高产', 'High yield'],
    ['STEP 1 / 4 · 链上', 'STEP 1 / 4 · On-chain'],
    ['先连钱包，再铸士兵', 'Connect a wallet, then mint soldiers'],
    ['游戏开局没有免费士兵。连接 BSC Testnet 钱包，免费铸造士兵 NFT；链上有几个 NFT，游戏军团就有几个士兵。', 'You start with no free soldiers. Connect a BSC Testnet wallet and mint soldier NFTs for free; the number of NFTs on-chain equals your in-game army.'],
    ['80% 进士兵口袋', '80% goes to soldier pockets'],
    ['地块产出的 80% 按战力进入驻军士兵口袋；只有销毁士兵，口袋代币才会转入个人金库。', '80% of tile output enters garrison soldiers\' pockets by power; pocket ORE moves to your personal wallet only when a soldier is burned.'],
    ['结婚、繁衍、卖子嗣', 'Marry, breed, sell children'],
    ['一男一女结缘，消耗 ORE 生出新兵。孩子三维 = (父 + 母) × 1.0～1.2，口袋为 0；可以留下，也可以挂牌出售。', 'Pair one male and one female, spend ORE and produce a child. Child stats = (father + mother) × 1.0–1.2, pocket starts at 0; keep or list for sale.'],
    ['打下城池，抢走地块金库', 'Take a city, seize its vault'],
    ['攻城 30 秒后结算。胜利后接管产出，并把该地块 20% 金库按战力分给参战士兵。', 'A siege resolves after 30 seconds. Victory transfers output and distributes 20% of the tile vault to surviving attackers by power.'],
    ['三族陈兵，', 'Three factions mass their armies, '],
    ['钱包', 'Wallet'],
    ['铸造', 'Mint'],
    ['士兵', 'soldiers'],
    ['链上', 'On-chain'],
    ['自动召唤', 'auto-summon'],
    ['同步军团', 'Sync Army'],
    ['免费铸造士兵 NFT', 'mint soldier NFTs for free'],
    ['连接右上角 BSC 钱包', 'Connect the top-right BSC wallet'],
    ['块矿脉、', 'tiles of ore,'],
    ['座基地与', 'base and'],
    ['块矿脉', 'tiles of ore'],
    ['座基地', 'base'],
    ['人；', 'soldiers;'],
    ['你以', 'You as '],
    ['STEP 2 / 4 · 口袋', 'STEP 2 / 4 · Pockets'],
    ['STEP 3 / 4 · 血脉', 'STEP 3 / 4 · Bloodline'],
    ['STEP 4 / 4 · 战争', 'STEP 4 / 4 · War'],
    ['上一步', 'Previous'],
    ['口袋', 'Pocket'],
    ['地块产出的 ', 'Of tile output, '],
    [' 按战力进入驻军士兵口袋；只有销毁士兵，口袋代币才会转入个人金库。', ' enters garrison soldiers\' pockets by power; only burning a soldier moves its pocket ORE to your personal wallet.'],
    ['只有销毁士兵，口袋代币才会转入个人金库。', 'Only burning a soldier moves its pocket ORE to your personal wallet.'],
    ['按战力进入驻军士兵口袋', 'enters garrison soldiers\' pockets by power'],
    ['口袋代币', 'pocket ORE'],
    ['个人金库', 'personal wallet'],
    ['结婚、繁衍、卖子嗣', 'Marry, breed, sell children'],
    ['一男一女结缘，消耗 ORE 生出新兵。孩子三维 = (父 + 母) × 1.0～1.2，口袋为 0；可以留下，也可以挂牌出售。', 'Pair one male and one female, spend ORE and produce a child. Child stats = (father + mother) × 1.0–1.2, pocket starts at 0; keep or list for sale.'],
    ['打下城池，抢走地块金库', 'Take a city, seize its vault'],
    ['攻城 30 秒后结算。胜利后接管产出，并把该地块 20% 金库按战力分给参战士兵。', 'A siege resolves after 30 seconds. Victory transfers output and distributes 20% of the tile vault to surviving attackers by power.'],
    ['森林王国将军', 'Forest Kingdom General'],
    ['两族 AI 军团各 ', 'Two AI factions, '],
    [' 人；你的军团由 BSC Testnet 上的士兵 NFT 决定。', ' soldiers; your army is determined by soldier NFTs on BSC Testnet.'],
    ['当前军团为 0。', 'Current army is 0.'],
    [' 连接右上角 BSC 钱包 → 免费铸造士兵 NFT → 同步军团，链上有几个 NFT 就有几个士兵。', ' Connect the top-right BSC wallet → mint soldier NFTs for free → sync army; one soldier per NFT on-chain.'],
    ['你以 ', 'You as '],
    [' 之名入伍，', ' enlisted and '],
    ['你', 'You'],
    ['人', ' soldiers'],
    ['块', ' tiles'],
    ['只有销毁士兵，', 'Only by burning a soldier, '],
    ['口袋代币才会转入个人金库。', 'does pocket ORE move to your personal wallet.'],
    ['距基地', 'From base'],
    ['地块金库', 'Tile vault'],
    ['基地产矿最低', 'Lowest base output'],
    ['三座基地在球面上互相等距', 'Three bases equally spaced on the sphere'],
    ['ORE/分', 'ORE/min'],
    ['男', 'Male'],
    ['女', 'Female'],
    ['单机模拟', 'Single-player simulation'],
    ['单机', 'Single-player'],
    ['第', 'Gen '],
    ['第2代', 'Gen 2'],
    ['第1代', 'Gen 1'],
    ['第3代', 'Gen 3'],
    ['低于', 'Below'],
    ['高于', 'Above'],
    ['士兵', 'soldiers', '士兵', 'soldats', 'солдаты', '兵士', '병사', 'lính', 'جنود'],
    ['男性', 'Male', '男性', 'Homme', 'Мужчина', '男性', '남성', 'Nam', 'رجل'],
    ['女性', 'Female', '女性', 'Femme', 'Женщина', '女性', '여성', 'Nữ', 'امرأة'],
    ['男', 'Male', '男', 'Homme', 'Мужчина', '男性', '남성', 'Nam', 'رجل'],
    ['女', 'Female', '女', 'Femme', 'Женщина', '女性', '여성', 'Nữ', 'امرأة'],
    ['各', 'each', '各', 'chaque', 'каждый', 'それぞれ', '각', 'mỗi', 'كل'],
    ['第', 'Gen ', '第', 'Gén. ', 'Пок. ', '第', '세대 ', 'Đời ', 'الجيل '],
    ['低于', 'Below', '低於', 'Inférieur', 'Ниже', '未満', '미만', 'Dưới', 'أقل من'],
    ['高于', 'Above', '高於', 'Supérieur', 'Выше', '超', '초과', 'Trên', 'أعلى من'],
    [" 连接右上角 BSC 钱包 → 免费铸造士兵 NFT → 同步军团，链上有几个 NFT 就有几个士兵。", " Connect the top-right BSC wallet → mint soldier NFTs for free → sync army; one soldier per NFT on-chain.", " 連接右上角 BSC 錢包 → 免費鑄造士兵 NFT → 同步軍團，鏈上有幾個 NFT 就有幾個士兵。", " Connectez le portefeuille BSC en haut à droite → frappez des NFT de soldats gratuitement → synchronisez l'armée ; un soldat par NFT on-chain.", " Подключите кошелёк BSC справа сверху → бесплатно выпустите NFT солдат → синхронизируйте армию; один солдат на каждый NFT в сети.", " 右上のBSCウォレットを接続 → 兵士NFTを無料で鋳造 → 軍団を同期。オンチェーンNFTの数だけ兵士がいます。", " 오른쪽 위 BSC 지갑을 연결 → 병사 NFT를 무료로 발행 → 군단 동기화. 온체인 NFT 수만큼 병사가 있습니다.", " Kết nối ví BSC ở góc trên bên phải → đúc NFT lính miễn phí → đồng bộ quân đoàn; mỗi NFT trên chuỗi là một lính.", " اربط محفظة BSC في الأعلى يمينًا → اسك NFT الجنود مجانًا → زامن الجيش؛ جندي واحد لكل NFT على السلسلة."],
    ["行军", "Marching", "行軍", "En marche", "Марш", "行軍", "행군", "Hành quân", "مسيرة"],
    ["育中", "Pregnant", "育中", "Gestation", "Беременна", "妊娠中", "임신 중", "Mang thai", "حامل"],
    ["待命", "Idle", "待命", "En attente", "В ожидании", "待機", "대기", "Chờ lệnh", "في الانتظار"],
    ["驻防", "Garrison", "駐防", "Garnison", "Гарнизон", "駐屯", "주둔", "Đồn trú", "حامية"],
    ["阵亡", "Fallen", "陣亡", "Tombés", "Погибшие", "戦死", "전사", "Tử trận", "قتلى"],
    ["在役", "Active", "在役", "Actifs", "В строю", "現役", "복무", "Đang phục vụ", "في الخدمة"],
    ["复活", "Revive", "復活", "Réapparaître", "Воскресить", "復活", "부활", "Hồi sinh", "إحياء"],
    ["单机", "Solo", "單機", "Solo", "Одиночная", "ソロ", "솔로", "Chơi đơn", "فردي"],
    ["森林王国领先 · 基地不可攻击", "Royaume de la forêt en tête · Base inattaquable", "森林王國領先 · 基地不可攻擊", "Royaume de la forêt en tête · Base inattaquable", "Лесное королевство впереди · База неатакуема", "森林王国リード · 基地攻撃不可", "숲 왕국 선두 · 기지 공격 불가", "Vương quốc Rừng dẫn đầu · Căn cứ không thể tấn công", "مملكة الغابة متقدمة · القاعدة غير قابلة للهجوم"],
    ["南极王国领先 · 基地不可攻击", "Royaume antarctique en tête · Base inattaquable", "南極王國領先 · 基地不可攻擊", "Royaume antarctique en tête · Base inattaquable", "Антарктическое королевство впереди · База неатакуема", "南極王国リード · 基地攻撃不可", "남극 왕국 선두 · 기지 공격 불가", "Vương quốc Nam Cực dẫn đầu · Căn cứ không thể tấn công", "المملكة القطبية متقدمة · القاعدة غير قابلة للهجوم"],
    ["沙漠王国领先 · 基地不可攻击", "Royaume du désert en tête · Base inattaquable", "沙漠王國領先 · 基地不可攻擊", "Royaume du désert en tête · Base inattaquable", "Пустынное королевство впереди · База неатакуема", "砂漠王国リード · 基地攻撃不可", "사막 왕국 선두 · 기지 공격 불가", "Vương quốc Sa mạc dẫn đầu · Căn cứ không thể tấn công", "مملكة الصحراء متقدمة · القاعدة غير قابلة للهجوم"],
    ["中立之地 · 基地不可攻击", "Neutral land · Base unattackable", "中立之地 · 基地不可攻擊", "Territoire neutre · Base inattaquable", "Нейтральная земля · База неатакуема", "中立地 · 基地攻撃不可", "중립지 · 기지 공격 불가", "Vùng trung lập · Căn cứ không thể tấn công", "أرض محايدة · القاعدة غير قابلة للهجوم"],
    [" / 141 · 基地 ", " / 141 · Base ", " / 141 · 基地 ", " / 141 · Base ", " / 141 · База ", " / 141 · 基地 ", " / 141 · 기지 ", " / 141 · Căn cứ ", " / 141 · قاعدة "],
    ["数量", "Quantity", "數量", "Quantité", "Количество", "数量", "수량", "Số lượng", "الكمية"],
    ["提取", "Withdraw", "提取", "Retirer", "Вывести", "引き出す", "인출", "Rút", "سحب"],
    ["充值", "Deposit", "充值", "Recharger", "Пополнить", "入金", "충전", "Nạp", "إيداع"],
    ["本地", "Local", "本地", "Local", "Локально", "ローカル", "로컬", "Cục bộ", "محلي"],
    ["供应", "Supply", "供應", "Offre", "Предложение", "供給", "공급", "Nguồn cung", "العرض"],
    ["差", "Diff", "差", "Écart", "Разница", "差", "차이", "Chênh lệch", "الفرق"],
    ["价值", "Value", "價值", "Valeur", "Стоимость", "価値", "가치", "Giá trị", "القيمة"],
    ["总供应", "Total supply", "總供應", "Offre totale", "Общее предложение", "総供給", "총 공급", "Tổng cung", "إجمالي العرض"],
    ["提取数量", "Withdraw amount", "提取數量", "Montant à retirer", "Сумма вывода", "引出数量", "인출 수량", "Số lượng rút", "مبلغ السحب"],
    ["充值数量", "Deposit amount", "充值數量", "Montant à recharger", "Сумма пополнения", "入金数量", "충전 수량", "Số lượng nạp", "مبلغ الإيداع"],
    ["本地账本", "Local ledger", "本地帳本", "Registre local", "Локальный реестр", "ローカル台帳", "로컬 원장", "Sổ cái cục bộ", "دفتر محلي"],
    ["供应量", "Supply", "供應量", "Offre", "Объём предложения", "供給量", "공급량", "Nguồn cung", "كمية العرض"],
    ["价值差", "Value difference", "價值差", "Écart de valeur", "Разница стоимости", "価値差", "가치 차이", "Chênh lệch giá trị", "فرق القيمة"],
    ["配对", "Pair", "配對", "Apparier", "Сопоставить", "ペア", "페어", "Ghép cặp", "إقران"],
    ["配对中", "Pairing", "配對中", "Appariement", "Сопоставление", "ペアリング", "페어링", "Đang ghép cặp", "جارٍ الإقران"],
    ["可配对", "Available to pair", "可配對", "Disponible pour appariement", "Доступно для пары", "ペア可能", "페어 가능", "Có thể ghép cặp", "متاح للإقران"],
    ["按当前价格配对", "Pair at current price", "按當前價格配對", "Apparier au prix actuel", "Сопоставить по текущей цене", "現在価格でペア", "현재 가격으로 페어", "Ghép theo giá hiện tại", "إقران بالسعر الحالي"],
    ["按当前价格 1:1 配对", "1:1 pair at current price", "按當前價格 1:1 配對", "Appariement 1:1 au prix actuel", "Сопоставление 1:1 по текущей цене", "現在価格で1:1ペア", "현재 가격 1:1 페어", "Ghép 1:1 theo giá hiện tại", "إقران 1:1 بالسعر الحالي"],
    ["已配对注入 POL", "Paired into POL", "已配對注入 POL", "Apparié dans le POL", "Сопоставлено в POL", "POLへペア注入済み", "POL에 페어 주입됨", "Đã ghép vào POL", "تم الإقران في POL"],
    ["配对成协议流动性", "Paired into protocol liquidity", "配對成協議流動性", "Apparié en liquidité de protocole", "Сопоставлено с ликвидностью протокола", "プロトコル流動性へペア", "프로토콜 유동성으로 페어", "Ghép thành thanh khoản giao thức", "إقران في سيولة البروتوكول"],
    ["余额不足（按当前价格配对）", "Insufficient balance (pair at current price)", "餘額不足（按當前價格配對）", "Solde insuffisant (apparier au prix actuel)", "Недостаточно средств (сопоставить по текущей цене)", "残高不足（現在価格でペア）", "잔액 부족(현재 가격으로 페어)", "Số dư không đủ (ghép theo giá hiện tại)", "رصيد غير كافٍ (إقران بالسعر الحالي)"],
    ["多人同服", "Shared World", "多人同服", "Monde partagé", "Общий мир", "共有ワールド", "공유 월드", "Thế giới chung", "عالم مشترك"],
    ["在线", "Online", "在線", "En ligne", "В сети", "オンライン", "온라인", "Trực tuyến", "متصل"],
    ["我的军团", "My legion", "我的軍團", "Ma légion", "Мой легион", "私の軍団", "내 군단", "Quân đoàn của tôi", "فيلقي"],
    ["选择一块与己方相邻的敌方地块", "Select an adjacent enemy tile", "選擇一塊與己方相鄰的敵方地塊", "Sélectionnez une parcelle ennemie adjacente", "Выберите соседний вражеский участок", "隣接する敵区画を選択", "인접한 적 타일을 선택하세요", "Chọn một ô địch liền kề", "اختر قطعة عدو مجاورة"],
    ["攻击", "Attack", "攻擊", "Attaquer", "Атаковать", "攻撃", "공격", "Tấn công", "هجوم"],
    ["招募", "Recruit", "招募", "Recruter", "Набрать", "募集", "모집", "Chiêu mộ", "تجنيب"],
    ["退出多人", "Exit shared world", "退出多人", "Quitter le monde partagé", "Выйти из общего мира", "共有ワールドを退出", "공유 월드 나가기", "Thoát thế giới chung", "مغادرة العالم المشترك"],
    ["加入了战场", "joined the battlefield", "加入了戰場", "a rejoint le champ de bataille", "присоединился к полю боя", "戦場に参加しました", "전장에 참가했습니다", "đã tham gia chiến trường", "انضم إلى ساحة المعركة"],
    ["己方领地", "Your territory", "己方領地", "Votre territoire", "Ваша территория", "自陣", "아군 영토", "Lãnh thổ của bạn", "أراضيك"],
    ["必须与己方地块相邻", "Must be adjacent to your territory", "必須與己方地塊相鄰", "Doit être adjacent à votre territoire", "Должен граничить с вашей территорией", "自陣に隣接している必要があります", "아군 타일과 인접해야 합니다", "Phải liền kề lãnh thổ của bạn", "يجب أن تكون مجاورة لأراضيك"],
    ["基地不可被攻击", "Base cannot be attacked", "基地不可被攻擊", "La base ne peut pas être attaquée", "Базу нельзя атаковать", "基地は攻撃できません", "기지는 공격할 수 없습니다", "Căn cứ không thể bị tấn công", "لا يمكن مهاجمة القاعدة"],
    ["派遣士兵数量", "Troops to send", "派遣士兵數量", "Troupes à envoyer", "Сколько войск отправить", "派遣する兵士数", "보낼 병사 수", "Số quân gửi", "عدد الجنود للإرسال"],
    ["战斗进行中", "Battles in progress", "戰鬥進行中", "Batailles en cours", "Идут бои", "戦闘中", "전투 진행 중", "Trận chiến đang diễn ra", "معارك جارية"],
    ["没有战斗", "No active battles", "沒有戰鬥", "Aucune bataille active", "Нет активных боёв", "戦闘なし", "진행 중인 전투 없음", "Không có trận chiến", "لا معارك نشطة"],
    ["排行榜", "Leaderboard", "排行榜", "Classement", "Таблица лидеров", "ランキング", "순위표", "Bảng xếp hạng", "لوحة الصدارة"],
    ["战报", "War feed", "戰報", "Journal de guerre", "Сводка боёв", "戦報", "전황", "Báo chiến sự", "تقارير الحرب"],
    ["暂无战报", "No reports yet", "暫無戰報", "Aucun rapport", "Пока нет сводок", "戦報なし", "전황 없음", "Chưa có báo cáo", "لا تقارير بعد"],
    ["攻击中", "Attacking", "攻擊中", "Attaque en cours", "Атака", "攻撃中", "공격 중", "Đang tấn công", "هجوم جارٍ"],
    ["失败", "Failed", "失敗", "Échec", "Неудача", "失敗", "실패", "Thất bại", "فشل"],
    ["取消", "Cancel", "取消", "Annuler", "Отмена", "キャンセル", "취소", "Hủy", "إلغاء"],
    ["占领", "Capture", "佔領", "Capturer", "Захватить", "占領", "점령", "Chiếm", "استيلاء"],
    ["用钱包签名登录", "Sign in with wallet", "用錢包簽名登入", "Se connecter avec le portefeuille", "Войти с кошельком", "ウォレットでサインイン", "지갑으로 로그인", "Đăng nhập bằng ví", "تسجيل الدخول بالمحفظة"],
    ["NFT 决定多人模式初始兵力。签名不会发送交易，也不会扣 Gas。", "NFTs determine your starting troops in multiplayer. Signing sends no transaction and costs no gas.", "NFT 決定多人模式初始兵力。簽名不會發送交易，也不會扣 Gas。", "Les NFT déterminent vos troupes initiales en multijoueur. La signature n’envoie aucune transaction et ne coûte pas de gas.", "NFT определяют стартовые войска в мультиплеере. Подпись не отправляет транзакцию и не требует газа.", "NFTがマルチプレイの初期兵力を決めます。署名はトランザクションを送信せず、ガスもかかりません。", "NFT가 멀티플레이 초기 병력을 결정합니다. 서명은 거래를 보내지 않으며 가스도 들지 않습니다.", "NFT quyết định quân số ban đầu trong chế độ nhiều người. Chữ ký không gửi giao dịch và không tốn gas.", "تحدد NFT قواتك الأولية في اللعب الجماعي. التوقيع لا يرسل معاملة ولا يكلف غازًا."],
    ["连接钱包并签名", "Connect wallet and sign", "連接錢包並簽名", "Connecter le portefeuille et signer", "Подключить кошелёк и подписать", "ウォレットを接続して署名", "지갑 연결 후 서명", "Kết nối ví và ký", "اربط المحفظة ووقّع"],
    ["未检测到钱包", "No wallet detected", "未偵測到錢包", "Aucun portefeuille détecté", "Кошелёк не найден", "ウォレットが見つかりません", "지갑을 찾을 수 없습니다", "Không phát hiện ví", "لم يتم العثور على محفظة"],
    ["连接钱包...", "Connecting wallet...", "連接錢包...", "Connexion du portefeuille...", "Подключение кошелька...", "ウォレット接続中...", "지갑 연결 중...", "Đang kết nối ví...", "جارٍ ربط المحفظة..."],
    ["请求签名...", "Requesting signature...", "請求簽名...", "Demande de signature...", "Запрос подписи...", "署名を要求中...", "서명 요청 중...", "Đang yêu cầu chữ ký...", "جارٍ طلب التوقيع..."],
    ["验证 NFT 与登录...", "Checking NFTs and signing in...", "驗證 NFT 與登入...", "Vérification des NFT et connexion...", "Проверка NFT и вход...", "NFTを確認してログイン中...", "NFT 확인 및 로그인 중...", "Đang kiểm tra NFT và đăng nhập...", "جارٍ التحقق من NFT وتسجيل الدخول..."],
    ["已进入多人同服", "entered the shared world", "已進入多人同服", "a rejoint le monde partagé", "вошёл в общий мир", "共有ワールドに入りました", "공유 월드에 입장했습니다", "đã vào thế giới chung", "دخل العالم المشترك"],
    ["钱包登录失败", "Wallet login failed", "錢包登入失敗", "Échec de la connexion au portefeuille", "Ошибка входа через кошелёк", "ウォレットログイン失敗", "지갑 로그인 실패", "Đăng nhập ví thất bại", "فشل تسجيل الدخول بالمحفظة"],
    ["战争", "War", "戰爭", "Guerre", "Война", "戦争", "전쟁", "Chiến tranh", "حرب"],
    ["军团", "Legion", "軍團", "Légion", "Легион", "軍団", "군단", "Quân đoàn", "فيلق"],
    ["婚育", "Breeding", "婚育", "Élevage", "Разведение", "繁殖", "번식", "Sinh sản", "تكاثر"],
    ["流动性", "Liquidity", "流動性", "Liquidité", "Ликвидность", "流動性", "유동성", "Thanh khoản", "سيولة"],
    ["我的士兵", "My soldiers", "我的士兵", "Mes soldats", "Мои солдаты", "私の兵士", "내 병사", "Lính của tôi", "جنودي"],
    ["等级", "Tier", "等級", "Palier", "Уровень", "階級", "등급", "Bậc", "المستوى"],
    ["世代", "Gen", "世代", "Gén.", "Поколение", "世代", "세대", "Thế hệ", "الجيل"],
    ["暂无士兵", "No soldiers", "暫無士兵", "Aucun soldat", "Нет солдат", "兵士なし", "병사 없음", "Không có lính", "لا جنود"],
    ["男方", "Male", "男方", "Homme", "Мужчина", "男性", "남성", "Nam", "ذكر"],
    ["女方", "Female", "女方", "Femme", "Женщина", "女性", "여성", "Nữ", "أنثى"],
    ["没有合适男性", "No eligible male", "沒有合適男性", "Aucun homme éligible", "Нет подходящего мужчины", "適した男性なし", "적합한 남성 없음", "Không có nam phù hợp", "لا ذكر مؤهل"],
    ["没有合适女性", "No eligible female", "沒有合適女性", "Aucune femme éligible", "Нет подходящей женщины", "適した女性なし", "적합한 여성 없음", "Không có nữ phù hợp", "لا أنثى مؤهلة"],
    ["孕育中", "Pregnant", "孕育中", "Gestation", "Беременна", "妊娠中", "임신 중", "Mang thai", "حامل"],
    ["已挂牌", "Listed", "已掛牌", "En vente", "В продаже", "出品中", "판매 중", "Đang bán", "معروض"],
    ["挂牌出售", "List for sale", "掛牌出售", "Mettre en vente", "Выставить на продажу", "出品する", "판매 등록", "Đăng bán", "عرض للبيع"],
    ["价格", "Price", "價格", "Prix", "Цена", "価格", "가격", "Giá", "السعر"],
    ["挂牌", "List", "掛牌", "Mettre en vente", "Выставить", "出品", "등록", "Đăng bán", "عرض"],
    ["购买", "Buy", "購買", "Acheter", "Купить", "購入", "구매", "Mua", "شراء"],
    ["市场暂无挂牌", "No listings", "市場暫無掛牌", "Aucune annonce", "Нет объявлений", "出品なし", "판매 없음", "Không có tin đăng", "لا عروض"],
    ["添加流动性", "Add liquidity", "添加流動性", "Ajouter de la liquidité", "Добавить ликвидность", "流動性を追加", "유동성 추가", "Thêm thanh khoản", "إضافة سيولة"],
    ["移除流动性", "Remove liquidity", "移除流動性", "Retirer de la liquidité", "Убрать ликвидность", "流動性を削除", "유동성 제거", "Rút thanh khoản", "إزالة سيولة"],
    ["添加", "Add", "添加", "Ajouter", "Добавить", "追加", "추가", "Thêm", "إضافة"],
    ["移除", "Remove", "移除", "Retirer", "Убрать", "削除", "제거", "Rút", "إزالة"],
    ["市场", "Market", "市場", "Marché", "Рынок", "市場", "시장", "Chợ", "سوق"],
    ["士兵", "Soldier", "士兵", "Soldat", "Солдат", "兵士", "병사", "Lính", "جندي"],
    ["链上 ORE", "On-chain ORE", "鏈上 ORE", "ORE on-chain", "ORE в сети", "オンチェーン ORE", "온체인 ORE", "ORE trên chuỗi", "ORE على السلسلة"],
    ["游戏 ORE", "Game ORE", "遊戲 ORE", "ORE de jeu", "Игровое ORE", "ゲーム ORE", "게임 ORE", "ORE trong game", "ORE اللعبة"],
    ["一个钱包只能加入一个势力", "One wallet can join only one faction", "一個錢包只能加入一個勢力", "Un portefeuille ne peut rejoindre qu’une faction", "Один кошелёк может вступить только в одну фракцию", "1つのウォレットは1勢力のみ参加できます", "지갑 하나는 한 세력에만 가입할 수 있습니다", "Một ví chỉ có thể tham gia một thế lực", "محفظة واحدة تنضم إلى فصيل واحد فقط"],
    ["结为伴侣", "Marry", "結為伴侶", "Se marier", "Поженить", "結婚", "결혼", "Kết hôn", "الزواج"],
    ["繁衍", "Breed", "繁衍", "Reproduire", "Размножать", "繁殖", "번식", "Sinh sản", "تكاثر"],
    ["配偶", "Spouse", "配偶", "Conjoint", "Супруг", "配偶者", "배우자", "Bạn đời", "الزوج"],
    ["生育", "Births", "生育", "Naissances", "Рождения", "出産", "출산", "Sinh", "الولادات"],
    ["冷却", "Cooldown", "冷卻", "Recharge", "Перезарядка", "クールダウン", "쿨다운", "Hồi chiêu", "تبريد"],
    ["可提现", "Withdrawable", "可提現", "Retirable", "Доступно к выводу", "引出可能", "인출 가능", "Có thể rút", "قابل للسحب"],
    ["铸造士兵", "Mint soldier", "鑄造士兵", "Frapper un soldat", "Выпустить солдата", "兵士を鋳造", "병사 발행", "Đúc lính", "سك جندي"],
    ["驻防", "Station", "駐防", "Stationner", "Разместить", "駐屯", "주둔", "Đồn trú", "تمركز"],
    ["撤回", "Withdraw", "撤回", "Retirer", "Отозвать", "撤回", "철수", "Rút về", "سحب"],
    ["加固", "Fortify", "加固", "Fortifier", "Укрепить", "強化", "강화", "Củng cố", "تحصين"],
    ["驻防 / 撤回", "Station / Withdraw", "駐防 / 撤回", "Stationner / Retirer", "Разместить / Отозвать", "駐屯 / 撤回", "주둔 / 철수", "Đồn trú / Rút về", "تمركز / سحب"],
    ["金库", "Vault", "金庫", "Coffre", "Хранилище", "金庫", "금고", "Kho", "الخزنة"],
    ["烧兵提取", "Burn & withdraw", "燒兵提取", "Brûler et retirer", "Сжечь и вывести", "焼却して引出", "소각 후 인출", "Đốt và rút", "حرق وسحب"],
    ["行军中", "Marching", "行軍中", "En marche", "В пути", "行軍中", "행군 중", "Đang hành quân", "في المسير"],
    ["经济", "Economy", "經濟", "Économie", "Экономика", "経済", "경제", "Kinh tế", "الاقتصاد"],
    ["士兵口袋", "Soldier pockets", "士兵口袋", "Poches des soldats", "Карманы солдат", "兵士のポケット", "병사 주머니", "Túi lính", "جيوب الجنود"],
    ["地块金库", "Tile vault", "地塊金庫", "Coffre de parcelle", "Хранилище участка", "区画金庫", "타일 금고", "Kho ô đất", "خزنة القطعة"],
    ["已排放", "Emitted", "已排放", "Émis", "Выпущено", "発行済み", "발행됨", "Đã phát hành", "المُصدر"],
    ["市场挂牌", "Listings", "市場掛牌", "Annonces", "Объявления", "出品", "판매 등록", "Tin đăng", "العروض"],
    ["玩家", "Players", "玩家", "Joueurs", "Игроки", "プレイヤー", "플레이어", "Người chơi", "اللاعبون"],
    ["离线收益已结算", "Offline earnings settled", "離線收益已結算", "Gains hors ligne réglés", "Офлайн-доход начислен", "オフライン収益を精算", "오프라인 수익 정산", "Thu nhập ngoại tuyến đã tất toán", "تمت تسوية أرباح عدم الاتصال"],
    ["士兵详情", "Soldier details", "士兵詳情", "Détails du soldat", "Детали солдата", "兵士詳細", "병사 상세", "Chi tiết lính", "تفاصيل الجندي"],
    ["职业", "Class", "職業", "Classe", "Класс", "職業", "직업", "Lớp", "الفئة"],
    ["品阶", "Tier", "品階", "Palier", "Уровень", "階級", "등급", "Bậc", "المستوى"],
    ["性别", "Gender", "性別", "Sexe", "Пол", "性別", "성별", "Giới tính", "الجنس"],
    ["口袋", "Pocket", "口袋", "Poche", "Карман", "ポケット", "주머니", "Túi", "الجيب"],
    ["状态", "Status", "狀態", "Statut", "Статус", "状態", "상태", "Trạng thái", "الحالة"],
    ["子女", "Children", "子女", "Enfants", "Дети", "子供", "자녀", "Con cái", "الأبناء"],
    ["生育次数", "Births", "生育次數", "Naissances", "Рождения", "出産回数", "출산 횟수", "Số lần sinh", "الولادات"],
    ["父母", "Parents", "父母", "Parents", "Родители", "親", "부모", "Cha mẹ", "الوالدان"],
    ["士兵详情", "Soldier details", "士兵詳情", "Détails du soldat", "Детали солдата", "兵士詳細", "병사 상세", "Chi tiết lính", "تفاصيل الجندي"],
    ["服务器设置", "Server settings", "伺服器設定", "Paramètres serveur", "Настройки сервера", "サーバー設定", "서버 설정", "Cài đặt máy chủ", "إعدادات الخادم"],
    ["服务器", "Server", "伺服器", "Serveur", "Сервер", "サーバー", "서버", "Máy chủ", "الخادم"],
    ["关闭", "Close", "關閉", "Fermer", "Закрыть", "閉じる", "닫기", "Đóng", "إغلاق"],
    ["调防", "Station troops", "調防", "Stationner", "Разместить", "駐屯", "주둔", "Điều động", "تمركز القوات"],
    ["撤回驻军", "Withdraw garrison", "撤回駐軍", "Retirer la garnison", "Отозвать гарнизон", "駐軍撤回", "주둔군 철수", "Rút đồn trú", "سحب الحامية"],
    ["发动突袭", "Launch raid", "發動突襲", "Lancer un raid", "Начать рейд", "奇襲開始", "습격 개시", "Phát động tập kích", "شن غارة"],
    ["从相邻己方地块出发", "From adjacent friendly tile", "從相鄰己方地塊出發", "Depuis une parcelle alliée adjacente", "С соседнего своего участка", "隣接する自領から", "인접 아군 타일에서", "Từ ô đồng minh liền kề", "من قطعة صديقة مجاورة"],
    ["全部", "All", "全部", "Tout", "Все", "全部", "전부", "Tất cả", "الكل"],
    ["够赢即可", "Enough to win", "夠贏即可", "Assez pour gagner", "Достаточно для победы", "勝てる分だけ", "이길 만큼", "Đủ để thắng", "ما يكفي للفوز"],
    ["战力", "Power", "戰力", "Puissance", "Сила", "戦力", "전력", "Lực chiến", "القوة"],
    ["产出", "Output", "產出", "Production", "Добыча", "生産", "생산", "Sản lượng", "الإنتاج"],
    ["防御", "Defense", "防禦", "Défense", "Защита", "防御", "방어", "Phòng thủ", "الدفاع"],
    ["驻军", "Garrison", "駐軍", "Garnison", "Гарнизон", "駐軍", "주둔군", "Đồn trú", "الحامية"],
    ["不可攻击", "Cannot attack", "不可攻擊", "Attaque impossible", "Нельзя атаковать", "攻撃不可", "공격 불가", "Không thể tấn công", "لا يمكن الهجوم"],
    ["距基地越远，产矿越高", "Farther from your base, higher output", "距基地越遠，產礦越高", "Plus loin de votre base, plus la production est élevée", "Чем дальше от базы, тем выше добыча", "基地から遠いほど産出が高い", "기지에서 멀수록 생산량이 높습니다", "Càng xa căn cứ, sản lượng càng cao", "كلما زاد البعد عن القاعدة زاد الإنتاج"],
    ["基地不可被攻击", "Base cannot be attacked", "基地不可被攻擊", "La base ne peut pas être attaquée", "Базу нельзя атаковать", "基地は攻撃できません", "기지는 공격할 수 없습니다", "Căn cứ không thể bị tấn công", "لا يمكن مهاجمة القاعدة"],
    ["必须与己方地块相邻", "Must be adjacent to your territory", "必須與己方地塊相鄰", "Doit être adjacent à votre territoire", "Должен граничить с вашей территорией", "自領に隣接する必要があります", "아군 영토와 인접해야 합니다", "Phải tiếp giáp lãnh thổ của bạn", "يجب أن يكون مجاورًا لأراضيك"],
    ["敌方", "Enemy", "敵方", "Ennemi", "Противник", "敵", "적", "Địch", "العدو"],
    ["己方领地", "Friendly territory", "己方領地", "Territoire allié", "Своя территория", "自領", "아군 영토", "Lãnh thổ đồng minh", "أراضٍ صديقة"],
    ["选择一块与己方相邻的敌方地块", "Select an enemy tile adjacent to your territory", "選擇一塊與己方相鄰的敵方地塊", "Sélectionnez une parcelle ennemie adjacente", "Выберите вражеский участок рядом с вашей территорией", "自領に隣接する敵地を選択", "아군과 인접한 적 타일을 선택하세요", "Chọn ô địch tiếp giáp lãnh thổ", "اختر قطعة عدو مجاورة لأراضيك"],
    ["驻军提供防御", "Garrison provides defense", "駐軍提供防禦", "La garnison assure la défense", "Гарнизон даёт защиту", "駐軍が防御を提供", "주둔군이 방어를 제공합니다", "Đồn trú cung cấp phòng thủ", "الحامية توفر الدفاع"],
    ["无驻军时容易被占领", "Without a garrison it is easily captured", "無駐軍時容易被佔領", "Sans garnison, la parcelle tombe facilement", "Без гарнизона легко захватить", "駐軍がないと陥落しやすい", "주둔군이 없으면 점령되기 쉽습니다", "Không có đồn trú dễ bị chiếm", "بدون حامية يسهل احتلالها"],
    ["当前驻军", "Current garrison", "當前駐軍", "Garnison actuelle", "Текущий гарнизон", "現在の駐軍", "현재 주둔군", "Đồn trú hiện tại", "الحامية الحالية"],
    ["上限", "Max", "上限", "Max", "Максимум", "上限", "최대", "Tối đa", "الحد الأقصى"],
    ["地块防御", "Tile defense", "地塊防禦", "Défense de la parcelle", "Защита участка", "区画防御", "타일 방어", "Phòng thủ ô đất", "دفاع القطعة"],
    ["含驻军", "Includes garrison", "含駐軍", "Garnison incluse", "С гарнизоном", "駐軍込み", "주둔군 포함", "Gồm đồn trú", "يشمل الحامية"],
    ["待命士兵", "Idle soldiers", "待命士兵", "Soldats en attente", "Свободные солдаты", "待機兵", "대기 병사", "Lính chờ", "جنود احتياط"],
    ["可调派", "Available", "可調派", "Disponibles", "Доступно", "派遣可能", "파견 가능", "Có thể điều", "متاح"],
    ["派驻数量", "Station count", "派駐數量", "Nombre à stationner", "Количество", "駐屯数", "주둔 수", "Số lượng đồn trú", "عدد التمركز"],
    ["派驻", "Station", "派駐", "Stationner", "Разместить", "駐屯", "주둔", "Đồn trú", "تمركز"],
    ["撤回全部", "Withdraw all", "撤回全部", "Tout retirer", "Отозвать всех", "すべて撤回", "전부 철수", "Rút tất cả", "سحب الكل"],
    ["驻军名单", "Garrison roster", "駐軍名單", "Liste de la garnison", "Список гарнизона", "駐軍名簿", "주둔군 명단", "Danh sách đồn trú", "قائمة الحامية"],
    ["无驻军", "No garrison", "無駐軍", "Aucune garnison", "Нет гарнизона", "駐軍なし", "주둔군 없음", "Không có đồn trú", "لا حامية"],
    ["完成", "Done", "完成", "Terminé", "Готово", "完了", "완료", "Xong", "تم"],
    ["基地不可被攻击，可以存放预备队，也可以直接出兵。", "Base cannot be attacked; it can hold reserves and launch attacks.", "基地不可被攻擊，可以存放預備隊，也可以直接出兵。", "La base ne peut pas être attaquée ; elle peut stocker des réserves et lancer des attaques.", "Базу нельзя атаковать; она хранит резерв и может атаковать.", "基地は攻撃できません。予備隊を置き、攻撃も可能です。", "기지는 공격할 수 없으며 예비대를 두고 공격할 수 있습니다.", "Căn cứ không thể bị tấn công; có thể chứa dự bị và xuất kích.", "لا يمكن مهاجمة القاعدة؛ يمكنها حفظ الاحتياطي وشن الهجمات."],
    ["驻军提供防御。无驻军的地块会很快被占领。", "Garrison provides defense. Tiles without a garrison fall quickly.", "駐軍提供防禦。無駐軍的地塊會很快被佔領。", "La garnison assure la défense. Sans garnison, une parcelle tombe vite.", "Гарнизон даёт защиту. Участок без гарнизона быстро падёт.", "駐軍が防御を提供します。駐軍のない区画はすぐ陥落します。", "주둔군이 방어를 제공합니다. 주둔군이 없는 타일은 곧 함락됩니다.", "Đồn trú cung cấp phòng thủ. Ô không có đồn trú sẽ nhanh chóng thất thủ.", "الحامية توفر الدفاع. القطع بدون حامية تسقط بسرعة."],
    ["基地不可被攻击，可以存放预备队，也可以直接出兵", "Base cannot be attacked; it can hold reserves and launch attacks", "基地不可被攻擊，可以存放預備隊，也可以直接出兵", "La base ne peut pas être attaquée ; elle peut stocker des réserves et lancer des attaques", "Базу нельзя атаковать; она хранит резерв и может атаковать", "基地は攻撃できません。予備隊を置き、攻撃も可能です", "기지는 공격할 수 없으며 예비대를 두고 공격할 수 있습니다", "Căn cứ không thể bị tấn công; có thể chứa dự bị và xuất kích", "لا يمكن مهاجمة القاعدة؛ يمكنها حفظ الاحتياطي وشن الهجمات"],
    ["基地驻军是安全的预备队；从这里也可以直接出兵。", "The base garrison is a safe reserve; you can also launch attacks from here.", "基地駐軍是安全的預備隊；從這裡也可以直接出兵。", "La garnison de la base est une réserve sûre ; vous pouvez aussi attaquer d’ici.", "Гарнизон базы — безопасный резерв; отсюда тоже можно атаковать.", "基地駐軍は安全な予備隊です。ここから攻撃もできます。", "기지 주둔군은 안전한 예비대입니다. 여기서 공격도 가능합니다.", "Đồn trú căn cứ là lực lượng dự bị an toàn; có thể xuất kích từ đây.", "حامية القاعدة احتياطي آمن؛ يمكن شن الهجمات منها."],
    ["驻军按防御从高到低调派。撤回会立刻清空该地块驻军，请留意战报中的敌军行军。", "Garrison troops are sent by highest DEF. Withdraw clears the tile garrison immediately; watch enemy marches.", "駐軍按防禦從高到低調派。撤回會立刻清空該地塊駐軍，請留意戰報中的敵軍行軍。", "Les troupes sont envoyées par DEF la plus haute. Le retrait vide immédiatement la garnison ; surveillez les marches ennemies.", "Гарнизон отправляется по убыванию DEF. Отзыв сразу очищает гарнизон; следите за маршами врага.", "駐軍は防御の高い順に派遣されます。撤回すると即座に空になり、敵の行軍に注意してください。", "주둔군은 방어력 순으로 파견됩니다. 철수하면 즉시 비워지니 적 행군을 주의하세요.", "Quân đồn trú được phái theo DEF cao nhất. Rút sẽ xóa ngay đồn trú; chú ý hành quân địch.", "تُرسل حامية حسب أعلى دفاع. السحب يفرغ الحامية فورًا؛ راقب مسير العدو."],
    ["基地", "Base", "基地", "Base", "База", "基地", "기지", "Căn cứ", "القاعدة"],
    ["完成", "Done", "完成", "Terminé", "Готово", "完了", "완료", "Xong", "تم"],
    ["首页", "Home", "首頁", "Accueil", "Главная", "ホーム", "홈", "Trang chủ", "الرئيسية"],
    ["胜率", "Win chance", "勝率", "Chance de victoire", "Шанс победы", "勝率", "승률", "Tỷ lệ thắng", "فرصة الفوز"],
    ["若胜预计损失", "Estimated losses if win", "若勝預計損失", "Pertes estimées en cas de victoire", "Ожидаемые потери при победе", "勝利時の損失見込み", "승리 시 예상 손실", "Tổn thất dự kiến nếu thắng", "الخسائر المتوقعة عند الفوز"],
    ["若败损失", "Losses if defeat", "若敗損失", "Pertes en cas de défaite", "Потери при поражении", "敗北時の損失", "패배 시 손실", "Tổn thất nếu thua", "الخسائر عند الهزيمة"],
    ["攻占后夺取地块金库", "Capture loots the tile vault", "攻佔後奪取地塊金庫", "La capture pille le coffre de la parcelle", "Захват забирает хранилище участка", "占領時に区画金庫を奪う", "점령 시 타일 금고 획득", "Chiếm đoạt kho ô đất", "الاستيلاء على خزنة القطعة"],
    ["按战力分给参战士兵", "Split by power among attackers", "按戰力分給參戰士兵", "Réparti selon la puissance entre les attaquants", "Распределяется по силе между атакующими", "攻撃兵の戦力比で分配", "공격 병력 전력 비율로 분배", "Chia theo lực chiến cho lính tham chiến", "توزع حسب القوة على المهاجمين"],
    ["人", "soldiers", "人", "soldats", "солдат", "人", "명", "lính", "جنود"],
    ["待铸造子嗣", "Children awaiting mint", "待鑄造子嗣", "Enfants à frapper", "Дети ждут минта", "鋳造待ちの子", "민팅 대기 자녀", "Con chờ đúc", "أبناء بانتظار السك"],
    ["需要铸造 NFT", "Needs NFT mint", "需要鑄造 NFT", "Nécessite un mint NFT", "Нужен минт NFT", "NFT鋳造が必要", "NFT 민팅 필요", "Cần đúc NFT", "يحتاج سك NFT"],
    ["铸造士兵 NFT", "Mint soldier NFT", "鑄造士兵 NFT", "Frapper le NFT soldat", "Сминтить NFT солдата", "兵士NFTを鋳造", "병사 NFT 발행", "Đúc NFT lính", "سك NFT الجندي"],
    ["新生儿", "Newborn", "新生兒", "Nouveau-né", "Новорождённый", "新生児", "신생아", "Trẻ sơ sinh", "مولود جديد"],
    ["个", "children", "個", "enfants", "детей", "人", "명", "con", "أطفال"],
    ["我的 ORE", "My ORE", "我的 ORE", "Mon ORE", "Мои ORE", "自分の ORE", "내 ORE", "ORE của tôi", "ORE الخاصة بي"],
    ["市场挂牌", "Listings", "市場掛牌", "Annonces", "Объявления", "出品", "판매 등록", "Tin đăng", "العروض"],
    ["我的挂牌", "My listings", "我的掛牌", "Mes annonces", "Мои объявления", "自分の出品", "내 판매 등록", "Tin của tôi", "عروضي"],
    ["挂牌出售", "List for sale", "掛牌出售", "Mettre en vente", "Выставить на продажу", "出品する", "판매 등록", "Đăng bán", "عرض للبيع"],
    ["成交后士兵口袋 ORE 随士兵转移", "Pocket ORE moves with the soldier after sale", "成交後士兵口袋 ORE 隨士兵轉移", "Le pocket ORE suit le soldat après la vente", "ORE из кармана переходит с солдатом", "売却後、兵士のポケットOREも移行します", "판매 후 병사 주머니 ORE도 함께 이전됩니다", "ORE trong túi đi theo lính sau khi bán", "تنتقل ORE الجيب مع الجندي بعد البيع"],
    ["选择士兵（仅待命 / 未婚）", "Select soldier (idle / unmarried)", "選擇士兵（僅待命 / 未婚）", "Choisir un soldat (inactif / célibataire)", "Выберите солдата (свободен / не женат)", "兵士を選択（待機 / 未婚）", "병사 선택 (대기 / 미혼)", "Chọn lính (chờ / chưa kết hôn)", "اختر جنديًا (احتياط / غير متزوج)"],
    ["标价（ORE）", "Price (ORE)", "標價（ORE）", "Prix (ORE)", "Цена (ORE)", "価格（ORE）", "가격 (ORE)", "Giá (ORE)", "السعر (ORE)"],
    ["下架", "Cancel", "下架", "Retirer", "Снять", "取り下げ", "내리기", "Hủy", "إلغاء"],
    ["买入", "Buy", "買入", "Acheter", "Купить", "購入", "구매", "Mua", "شراء"],
    ["市场暂无挂牌", "No listings", "市場暫無掛牌", "Aucune annonce", "Нет объявлений", "出品なし", "판매 등록 없음", "Không có tin đăng", "لا توجد عروض"],
    ["没有挂牌", "No listings", "沒有掛牌", "Aucune annonce", "Нет объявлений", "出品なし", "판매 등록 없음", "Không có tin đăng", "لا توجد عروض"],
    ["黑市", "Black market", "黑市", "Marché noir", "Чёрный рынок", "闇市場", "암시장", "Chợ đen", "السوق السوداء"],
    ["士兵、ORE 与流动性", "Soldiers, ORE and liquidity", "士兵、ORE 與流動性", "Soldats, ORE et liquidité", "Солдаты, ORE и ликвидность", "兵士、ORE、流動性", "병사, ORE, 유동성", "Lính, ORE và thanh khoản", "الجنود وORE والسيولة"],
    ["士兵钱包", "Soldier wallet", "士兵錢包", "Portefeuille soldats", "Кошелёк солдат", "兵士ウォレット", "병사 지갑", "Ví lính", "محفظة الجنود"],
    ["链上钱包", "On-chain wallet", "鏈上錢包", "Portefeuille on-chain", "Кошелёк в сети", "オンチェーンウォレット", "온체인 지갑", "Ví on-chain", "محفظة على السلسلة"],
    ["链上", "On-chain", "鏈上", "On-chain", "В сети", "オンチェーン", "온체인", "On-chain", "على السلسلة"],
    ["链上市场", "On-chain market", "鏈上市場", "Marché on-chain", "Маркет в сети", "オンチェーンマーケット", "온체인 마켓", "Chợ on-chain", "السوق على السلسلة"],
    ["链上士兵市场", "On-chain soldier market", "鏈上士兵市場", "Marché de soldats on-chain", "Маркет солдат в сети", "オンチェーン兵士市場", "온체인 병사 마켓", "Chợ lính on-chain", "سوق الجنود على السلسلة"],
    ["读取链上挂牌…", "Reading on-chain listings…", "讀取鏈上掛牌…", "Lecture des annonces on-chain…", "Загрузка объявлений…", "オンチェーン出品を読み込み中…", "온체인 판매 등록 읽는 중…", "Đang đọc tin on-chain…", "جارٍ قراءة العروض على السلسلة…"],
    ["刷新", "Refresh", "刷新", "Actualiser", "Обновить", "更新", "새로고침", "Làm mới", "تحديث"],
    ["返回市场", "Back to market", "返回市場", "Retour au marché", "Назад на рынок", "マーケットに戻る", "마켓으로 돌아가기", "Quay lại chợ", "العودة إلى السوق"],
    ["链上卖家", "On-chain seller", "鏈上賣家", "Vendeur on-chain", "Продавец в сети", "オンチェーン出品者", "온체인 판매자", "Người bán on-chain", "البائع على السلسلة"],
    ["链上买入", "Buy on-chain", "鏈上買入", "Acheter on-chain", "Купить в сети", "オンチェーンで購入", "온체인 구매", "Mua on-chain", "شراء على السلسلة"],
    ["链上挂牌", "List on-chain", "鏈上掛牌", "Lister on-chain", "Выставить в сети", "オンチェーン出品", "온체인 등록", "Đăng on-chain", "عرض على السلسلة"],
    ["链上暂无挂牌", "No on-chain listings", "鏈上暫無掛牌", "Aucune annonce on-chain", "Нет объявлений в сети", "オンチェーン出品なし", "온체인 등록 없음", "Không có tin on-chain", "لا توجد عروض على السلسلة"],
    ["直接调用 OreMarket，钱包支付 ORE", "Calls OreMarket directly; wallet pays ORE", "直接調用 OreMarket，錢包支付 ORE", "Appelle OreMarket directement ; le portefeuille paie en ORE", "Прямой вызов OreMarket; кошелёк платит ORE", "OreMarketを直接呼び出し、ウォレットでORE支払い", "OreMarket 직접 호출, 지갑에서 ORE 결제", "Gọi OreMarket trực tiếp; ví trả ORE", "يستدعي OreMarket مباشرة؛ المحفظة تدفع ORE"],
    ["价格 ORE", "Price ORE", "價格 ORE", "Prix ORE", "Цена ORE", "価格 ORE", "가격 ORE", "Giá ORE", "السعر ORE"],
    ["链上成交后士兵属性随 NFT 转移；口袋 ORE 不随 NFT 转移。", "Attributes follow the NFT on-chain; pocket ORE is not carried.", "鏈上成交後士兵屬性隨 NFT 轉移；口袋 ORE 不隨 NFT 轉移。", "Les attributs suivent le NFT ; le pocket ORE ne suit pas.", "Атрибуты следуют за NFT; ORE из кармана не переносится.", "オンチェーン成交後、属性はNFTに従います。ポケットOREは移行しません。", "온체인 거래 후 속성은 NFT를 따르며, 주머니 ORE는 이전되지 않습니다.", "Thuộc tính đi theo NFT; ORE trong túi không đi theo.", "تتبع السمات الـ NFT؛ لا تنتقل ORE الجيب."],
    ["没有可挂牌士兵", "No soldier available", "沒有可掛牌士兵", "Aucun soldat disponible", "Нет доступных солдат", "出品可能な兵士なし", "등록 가능한 병사 없음", "Không có lính để đăng", "لا يوجد جندي متاح"],
    ["支付", "Pay", "支付", "Payer", "Оплатить", "支払う", "결제", "Thanh toán", "دفع"],
    ["结婚费用", "Marriage fee", "結婚費用", "Frais de mariage", "Плата за брак", "結婚費用", "결혼 비용", "Phí kết hôn", "رسوم الزواج"],
    ["生育费用", "Birth fee", "生育費用", "Frais de naissance", "Плата за рождение", "出産費用", "출산 비용", "Phí sinh sản", "رسوم الولادة"],
    ["我的链上挂牌", "My on-chain listings", "我的鏈上掛牌", "Mes annonces on-chain", "Мои объявления в сети", "自分のオンチェーン出品", "내 온체인 등록", "Tin on-chain của tôi", "عروضي على السلسلة"],
    ["取消挂牌", "Cancel listing", "取消掛牌", "Retirer l’annonce", "Снять объявление", "出品を取り消す", "등록 취소", "Hủy đăng", "إلغاء العرض"],
    ["没有链上挂牌", "No on-chain listings", "沒有鏈上掛牌", "Aucune annonce on-chain", "Нет объявлений в сети", "オンチェーン出品なし", "온체인 등록 없음", "Không có tin on-chain", "لا توجد عروض على السلسلة"],
    ["领取未完成烧兵 ORE", "Claim pending burn ORE", "領取未完成燒兵 ORE", "Récupérer l’ORE de brûlage en attente", "Получить отложенную ORE за сожжение", "未完了の焼却OREを受け取る", "미완료 소각 ORE 수령", "Nhận ORE đốt chưa hoàn tất", "استلام ORE الحرق المعلق"],
  ];

  // Localized soldier-name pools. Names are chosen deterministically from the
  // server name so the same soldier keeps one name per language.
  const NAME_POOLS = {
    en: { s: ['Ashford','Blackwood','Carter','Dunmore','Easton','Falk','Grey','Hale'], m: ['Alden','Bran','Cedric','Dorian','Edric','Gareth','Lucan','Roland'], f: ['Alys','Brienne','Celia','Daria','Elara','Freya','Isolde','Lyra'] },
    'zh-Hant': { s: ['鐵','霜','金','沙','石','風','狼','鴉','赤','蒼','玄','白','夜','雷','灰','山'], m: ['破軍','夜鷹','金戈','風烈','嘯月','川','守夜','歌','開','無咎','長庚','斷月','遼原','辰州','北望','古城'], f: ['夜鶯','霜華','月','蘭','紗','鈴','焰','翎','星','璃','飛','雪','鳶','棠','舞','寧'] },
    fr: { s: ['Moreau','Lefèvre','Rousseau','Girard','Bernard','Dubois','Laurent','Simon'], m: ['Alain','Bastien','Clovis','Damien','Étienne','Gaspard','Lucien','Renaud'], f: ['Agnès','Blanche','Camille','Delphine','Élodie','Fleur','Isabeau','Lucie'] },
    ru: { s: ['Волков','Соколов','Морозов','Лебедев','Орлов','Кузнецов','Попов','Новиков'], m: ['Алексей','Борис','Виктор','Дмитрий','Егор','Иван','Лев','Максим'], f: ['Анна','Вера','Дарья','Елена','Ирина','Ксения','Любовь','Мария'] },
    ja: { s: ['黒田','橘','源','平','藤原','北条','真田','上杉'], m: ['隼人','蓮','湊','陽介','颯','樹','仁','翼'], f: ['葵','結衣','凛','美咲','陽菜','楓','千尋','咲'] },
    ko: { s: ['김','이','박','최','정','강','조','윤'], m: ['민준','도윤','서준','지호','하준','은우','시우','준서'], f: ['서연','지우','하은','민서','지유','수아','윤서','채원'] },
    vi: { s: ['Trần','Nguyễn','Lê','Phạm','Hoàng','Vũ','Đặng','Bùi'], m: ['Minh','Hùng','Quang','Tuấn','Nam','Khang','Long','Bảo'], f: ['Lan','Mai','Hương','Linh','Trang','Vy','Anh','Nhi'] },
    ar: { s: ['الحداد','النجار','الخطيب','العلي','حسن','خليل','سعيد','منصور'], m: ['كريم','سامي','عمر','خالد','يوسف','زياد','فارس','آدم'], f: ['ليلى','نور','سارة','مريم','هند','رنا','جميلة','أمل'] },
  };
  function nameHash(s) {
    let h = 2166136261;
    for (const ch of String(s || '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function soldierName(name, gender) {
    const pool = NAME_POOLS[current] || NAME_POOLS.en;
    const h = nameHash(name);
    const g = gender === 'f' ? 'f' : gender === 'm' ? 'm' : (h & 1 ? 'f' : 'm');
    const surname = pool.s[h % pool.s.length];
    const given = pool[g][(h >>> 8) % pool[g].length];
    return surname + ' · ' + given;
  }
  const current = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    let saved = null;
    try { saved = localStorage.getItem('ore.lang'); } catch (e) {}
    const lang = q || saved || 'en';
    return ORDER.includes(lang) ? lang : 'en';
  })();
  try { localStorage.setItem('ore.lang', current); } catch (e) {}
  const idx = ORDER.indexOf(current);
  // Common simplified -> traditional fallback. Acronyms (ORE/NFT/BSC/LP/ETH/ATK)
  // stay as letters; Chinese words become Chinese even if a deep string has no
  // explicit Traditional translation yet.
  const TRAD = {
    '矿':'礦','链':'鏈','陈':'陳','钱':'錢','战':'戰','军':'軍','团':'團','国':'國','为':'為','这':'這','个':'個','来':'來','时':'時','后':'後','与':'與','无':'無','会':'會','开':'開','关':'關','闭':'閉','击':'擊','动':'動','买':'買','卖':'賣','资':'資','产':'產','说':'說','们':'們','过':'過','还':'還','进':'進','远':'遠','边':'邊','队':'隊','长':'長','门':'門','问':'問','间':'間','实':'實','现':'現','发':'發','给':'給','对':'對','应':'應','该':'該','从':'從','东':'東','头':'頭','风':'風','马':'馬','点':'點','术':'術','卫':'衛','骑':'騎','锋':'鋒','里':'裡','么':'麼','样':'樣','种':'種','数':'數','据':'據','网':'網','络':'絡','级':'級','别':'別','称':'稱','号':'號','银':'銀','铁':'鐵','钢':'鋼','启':'啟','态':'態','钟':'鐘','将':'將','领':'領','统':'統','师':'師','员':'員','伤':'傷','复':'復','烧':'燒','毁':'毀','灭':'滅','夺':'奪','脉':'脈','库':'庫','财':'財','奖':'獎','励':'勵','罚':'罰','规':'規','则':'則','条':'條','约':'約','签':'簽','证':'證','区':'區','块':'塊','转':'轉','声':'聲','响':'響','语':'語','译':'譯','换':'換','选':'選','择':'擇','设':'設','帮':'幫','册':'冊','斗':'鬥','御':'禦','锐':'銳','传':'傳','专':'專','属':'屬','决':'決','势':'勢','图':'圖','争':'爭','欢':'歡','经':'經','济':'濟','环':'環','离':'離','连':'連','费':'費','几':'幾','销':'銷','币':'幣','结':'結','维':'維','抢':'搶','胜':'勝','并':'並','参':'參','仓':'倉','仓':'倉','领':'領','头':'頭','么':'麼','将':'將','师':'師','团':'團','员':'員','长':'長','门':'門','问':'問','间':'間','闻':'聞','关':'關','闭':'閉','阅':'閱','读':'讀','写':'寫','话':'話','词':'詞','译':'譯','换':'換','选':'選','择':'擇','帮':'幫','册':'冊','术':'術','卫':'衛','骑':'騎','锋':'鋒','锐':'銳','传':'傳','专':'專','属':'屬','决':'決','势':'勢','图':'圖','争':'爭','欢':'歡','经':'經','济':'濟','环':'環','离':'離','连':'連','费':'費','几':'幾','销':'銷','币':'幣','结':'結','维':'維','抢':'搶','胜':'勝','并':'並','参':'參','仓':'倉','闭':'閉','开':'開','关':'關','为':'為','这':'這','个':'個','与':'與','后':'後','时':'時','来':'來','会':'會','无':'無','链':'鏈','矿':'礦','钱':'錢','战':'戰','军':'軍','团':'團','国':'國','击':'擊','动':'動','买':'買','卖':'賣','资':'資','产':'產','说':'說','们':'們','过':'過','还':'還','进':'進','远':'遠','边':'邊','队':'隊','长':'長','门':'門','问':'問','间':'間','实':'實','现':'現','发':'發','给':'給','对':'對','应':'應','该':'該','从':'從','东':'東','头':'頭','风':'風','马':'馬','点':'點','术':'術','卫':'衛','骑':'騎','锋':'鋒','里':'裡','么':'麼','样':'樣','种':'種','数':'數','据':'據','网':'網','络':'絡','级':'級','别':'別','称':'稱','号':'號','银':'銀','铁':'鐵','钢':'鋼','启':'啟','态':'態','钟':'鐘','将':'將','领':'領','统':'統','师':'師','员':'員','伤':'傷','复':'復','烧':'燒','毁':'毀','灭':'滅','夺':'奪','脉':'脈','库':'庫','财':'財','奖':'獎','励':'勵','罚':'罰','规':'規','则':'則','条':'條','约':'約','签':'簽','证':'證','区':'區','块':'塊','转':'轉','声':'聲','响':'響','语':'語','译':'譯','换':'換','选':'選','择':'擇','设':'設','帮':'幫','册':'冊','斗':'鬥','御':'禦','锐':'銳','传':'傳','专':'專','属':'屬','决':'決','势':'勢','图':'圖','争':'爭','欢':'歡','经':'經','济':'濟','环':'環','离':'離','连':'連','费':'費','几':'幾','销':'銷','币':'幣','结':'結','维':'維','抢':'搶','胜':'勝','并':'並','参':'參','仓':'倉','进':'進','远':'遠','边':'邊','队':'隊','长':'長'
  };
  const toTrad = (text) => String(text).replace(/[\u3400-\u9fff]/g, (ch) => TRAD[ch] || ch);
  const WORDS = {
    'zh-Hant': { Testnet: '測試網', SEASON: '賽季', LIVE: '即時', GENESIS: '創世', BRIEFING: '簡報', STEP: '步驟', ANTARCTIC: '南極', FOREST: '森林', DESERT: '沙漠' },
    fr: { Testnet: 'Testnet', SEASON: 'Saison', LIVE: 'Direct', GENESIS: 'Genèse', BRIEFING: 'Briefing', STEP: 'Étape', ANTARCTIC: 'Antarctique', FOREST: 'Forêt', DESERT: 'Désert' },
    ru: { Testnet: 'Тестнет', SEASON: 'Сезон', LIVE: 'В эфире', GENESIS: 'Генезис', BRIEFING: 'Брифинг', STEP: 'Шаг', ANTARCTIC: 'Антарктика', FOREST: 'Лес', DESERT: 'Пустыня' },
    ja: { Testnet: 'テストネット', SEASON: 'シーズン', LIVE: 'ライブ', GENESIS: 'ジェネシス', BRIEFING: 'ブリーフィング', STEP: 'ステップ', ANTARCTIC: '南極', FOREST: '森林', DESERT: '砂漠' },
    ko: { Testnet: '테스트넷', SEASON: '시즌', LIVE: '라이브', GENESIS: '제네시스', BRIEFING: '브리핑', STEP: '단계', ANTARCTIC: '남극', FOREST: '숲', DESERT: '사막' },
    vi: { Testnet: 'Mạng thử nghiệm', SEASON: 'Mùa', LIVE: 'Trực tiếp', GENESIS: 'Khởi nguyên', BRIEFING: 'Tóm tắt', STEP: 'Bước', ANTARCTIC: 'Nam Cực', FOREST: 'Rừng', DESERT: 'Sa mạc' },
    ar: { Testnet: 'شبكة الاختبار', SEASON: 'الموسم', LIVE: 'مباشر', GENESIS: 'التكوين', BRIEFING: 'إحاطة', STEP: 'خطوة', ANTARCTIC: 'القطب الجنوبي', FOREST: 'الغابة', DESERT: 'الصحراء' },
  };
  const WORDLIST = Object.entries(WORDS[current] || {}).sort((a, b) => b[0].length - a[0].length);
  // Soldier names are generated from a small Chinese name pool. In non-Chinese
  // locales show a stable pinyin/English form instead of leaving Chinese glyphs.
  const NAME_CHARS = {
    '铁':'Tie','霜':'Shuang','烬':'Jin','沙':'Sha','石':'Shi','风':'Feng','狼':'Lang','鸦':'Ya','赤':'Chi','苍':'Cang','玄':'Xuan','白':'Bai','夜':'Ye','雷':'Lei','灰':'Hui','金':'Jin','河':'He','山':'Shan','岚':'Lan','荒':'Huang','铜':'Tong','骨':'Gu','盐':'Yan','黑':'Hei','链':'Chain','誓':'sworn',
    '破':'Po','军':'jun','岩':'Yan','锋':'Feng','烈':'Lie','骁':'Xiao','朔':'Shuo','岳':'Yue','川':'Chuan','狩':'Shou','野':'Ye','戈':'Ge','铠':'Kai','无':'Wu','咎':'jiu','长':'Chang','庚':'geng','断':'Duan','燎':'Liao','原':'yuan','沉':'Chen','舟':'zhou','北':'Bei','望':'wang','孤':'Gu','城':'cheng','衣':'yi','逐':'Zhu','日':'ri','惊':'Jing','刃':'ren','踏':'Ta','雪':'Xue','焚':'Fen','莺':'ying','月':'Yue','砂':'Sha','铃':'Ling','烟':'Yan','绫':'Ling','星':'Xing','璃':'Li','绯':'Fei','鸢':'Yuan','棠':'Tang','雾':'Wu','澜':'Lan','宁':'Ning','羽':'yu','青':'Qing','崖':'ya','照':'Zhao','流':'Liu','萤':'ying','寒':'Han','酥':'su','拾':'Shi','光':'guang','归':'Gui','雁':'yan','银':'Yin','朱':'zhu','暮':'Mu','云':'yun',
  };
  const NAME_WORDS = {
    '破军':'Pojun','无咎':'Wujiu','长庚':'Changgeng','断岳':'Duanyue','燎原':'Liaoyuan','沉舟':'Chenzhou','北望':'Beiwang','孤城':'Gucheng','铁衣':'Tieyi','逐日':'Zhuri','惊雷':'Jinglei','霜刃':'Shuangren','踏雪':'Taxue','焚风':'Fenfeng','夜莺':'Yeying','烬羽':'Jinyu','青崖':'Qingya','照夜':'Zhaoye','流萤':'Liuying','寒酥':'Hansu','拾光':'Shiguang','归雁':'Guiyan','银朱':'Yinzhu','暮云':'Muyun','链誓':'Chainsworn',
  };
  const NAME_RE = /[\u3400-\u9fff]{1,4}·[\u3400-\u9fff]{1,4}/g;
  function romanName(name) {
    return String(name).split('·').map((part) => {
      if (NAME_WORDS[part]) return NAME_WORDS[part];
      return [...part].map((ch) => NAME_CHARS[ch] || ch).join('');
    }).join(' · ');
  }
  const table = new Map();
  const extraMap = new Map([...(window.ORE_I18N_EXTRA || []), ...(window.ORE_I18N_EXTRA2 || []), ...(window.ORE_I18N_EXTRA3 || [])].filter((r) => r && r[0]).map((r) => [r[0], r]));
  // Manual translations win, but if a manual row has only an English fallback,
  // take the generated target-language translation instead of leaking English.
  for (const row of ROWS) {
    let target = row[idx + 1];
    if (!target) {
      const ext = extraMap.get(row[0]);
      if (ext) target = ext[idx + 1];
    }
    if (!target && current === 'zh-Hant') target = toTrad(row[0]);
    table.set(row[0], target || row[1] || row[0]);
  }
  // Generated coverage for deep UI strings not present in the manual table.
  for (const [src, row] of extraMap) {
    if (table.has(src)) continue;
    let target = row[idx + 1];
    if (!target && current === 'zh-Hant') target = toTrad(src);
    table.set(src, target || row[1] || src);
  }
  const sorted = [...table.keys()].sort((a, b) => b.length - a.length);

  function tr(text) {
    if (!text) return text;
    let out = text;
    const lead = (text.match(/^\s*/) || [''])[0];
    const trail = (text.match(/\s*$/) || [''])[0];
    const core = text.trim();
    // Names are generated Chinese proper nouns, not UI vocabulary. Convert
    // them before phrase replacement so 链誓·无咎 does not become a hybrid.
    if (current === 'zh-Hant') out = out.replace(NAME_RE, (m) => toTrad(m));
    else out = out.replace(NAME_RE, (m) => romanName(m));
    if (table.has(text)) {
      // Prefer the full-string translation. This avoids composing a translated
      // sentence from short fallback tokens (e.g. "soldiers" inside Japanese).
      const translated = table.get(text);
      out = (lead || '') + translated.trim() + (trail || '');
    } else if (core && table.has(core)) {
      // Keep the surrounding spaces of a split feed/HTML text node.
      out = lead + table.get(core) + trail;
    } else {
      for (const src of sorted) {
        if (out.includes(src)) out = out.split(src).join(table.get(src));
      }
    }
    for (const [src, dst] of WORDLIST) {
      if (out.includes(src)) out = out.split(src).join(dst);
    }
    if (current === 'zh-Hant') out = out.replace(NAME_RE, (m) => toTrad(m));
    else out = out.replace(NAME_RE, (m) => romanName(m));
    return out;
  }
  function clan(key) {
    const n = ORE.data && ORE.data.CLAN && ORE.data.CLAN[key] && ORE.data.CLAN[key].name;
    return n ? tr(n) : key;
  }
  function unit(key) {
    const names = { guard: '盾卫', vanguard: '先锋', archer: '弓手', warlock: '术士', raider: '游骑' };
    return tr(names[key] || key);
  }

  // Translate text nodes and common attributes without touching source in the
  // script/style/lang-menu. If the app updates a node, translate it again.
  const last = new WeakMap();
  function skip(node) {
    let e = node.nodeType === 1 ? node : node.parentElement;
    while (e) {
      if (e.matches && (e.matches('script,style,#langMenu,[data-i18n-skip]'))) return true;
      e = e.parentElement;
    }
    return false;
  }
  function apply(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (skip(n)) continue;
      const src = n.nodeValue;
      if (!src) continue;
      const hasCjk = /[\u3400-\u9fff]/.test(src);
      const needsWord = WORDLIST.some(([k]) => src.includes(k));
      if (!hasCjk && !needsWord) continue;
      if (last.get(n) === src) continue;
      const out = tr(src);
      if (out !== src) { n.nodeValue = out; last.set(n, out); }
    }
    const attrs = ['title', 'placeholder', 'aria-label', 'alt'];
    const els = root.querySelectorAll ? root.querySelectorAll('[title],[placeholder],[aria-label],[alt]') : [];
    for (const el of els) {
      if (skip(el)) continue;
      for (const a of attrs) {
        const v = el.getAttribute(a);
        if (v && /[\u3400-\u9fff]/.test(v)) el.setAttribute(a, tr(v));
      }
    }
  }

  function applyMeta() {
    document.documentElement.lang = current;
    document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr';
    const titles = {
      en: 'ORE.ZONE — Three kingdoms, on-chain armies',
      'zh-Hant': '礦域 ORE.ZONE — 三族爭礦，鏈上為兵',
      fr: 'ORE.ZONE — Trois royaumes, armées on-chain',
      ru: 'ORE.ZONE — Три королевства, армии в сети',
      ja: 'ORE.ZONE — 三勢力の鉱脈争い、オンチェーン兵',
      ko: 'ORE.ZONE — 세 세력의 광맥 쟁탈, 온체인 군대',
      vi: 'ORE.ZONE — Ba vương quốc, quân đội trên chuỗi',
      ar: 'ORE.ZONE — ثلاث ممالك وجيوش على السلسلة',
    };
    document.title = titles[current] || titles.en;
  }

  function initLang() {
    applyMeta();
    const b = document.getElementById('btnLang');
    const menu = document.getElementById('langMenu');
    if (!b || !menu) return;
    const cur = LANGS.find((x) => x[0] === current) || LANGS[0];
    b.textContent = cur[2];
    b.title = cur[1];
    for (const btn of menu.querySelectorAll('[data-lang]')) {
      if (btn.dataset.lang === current) btn.setAttribute('aria-current', 'true');
      btn.onclick = () => {
        try { localStorage.setItem('ore.lang', btn.dataset.lang); } catch (e) {}
        location.reload();
      };
    }
    b.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
    document.addEventListener('click', () => { menu.hidden = true; });
    menu.onclick = (e) => e.stopPropagation();
  }

  ORE.i18n = { current, tr, clan, unit, name: soldierName, apply, LANGS };
  applyMeta();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { initLang(); apply(document.body); });
  else { initLang(); apply(document.body); }
  new MutationObserver(() => { apply(document.body); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(() => apply(document.body), 900);
})();
