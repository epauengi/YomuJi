// Counter readings cross-checked against https://www.tofugu.com/japanese/japanese-counters/.
export const KANJI_NUMBERS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"] as const;

type CounterObject = {
  id: string;
  label: string;
  noun: string;
  nounReading: string;
  counter: string;
  counterReading: string;
  image: string;
  usage: string;
  readings: readonly string[];
  notes: Readonly<Record<number, string>>;
};

export const COUNTER_OBJECTS: readonly CounterObject[] = [
  { id: "person", label: "Người", noun: "人", nounReading: "ひと", counter: "人", counterReading: "にん", image: "/images/counters/person.png", usage: "Đếm số người.", readings: ["ひとり", "ふたり", "さんにん", "よにん", "ごにん", "ろくにん", "しちにん", "はちにん", "きゅうにん", "じゅうにん"], notes: { 1: "Cách đọc riêng: ひとり.", 2: "Cách đọc riêng: ふたり.", 4: "よにん là cách đọc thường dùng.", 7: "Cũng có cách đọc ななにん." } },
  { id: "cat", label: "Mèo", noun: "猫", nounReading: "ねこ", counter: "匹", counterReading: "ひき", image: "/images/counters/cat.png", usage: "Đếm mèo và các động vật nhỏ.", readings: ["いっぴき", "にひき", "さんびき", "よんひき", "ごひき", "ろっぴき", "ななひき", "はっぴき", "きゅうひき", "じゅっぴき"], notes: { 1: "ひき biến âm thành ぴき.", 3: "ひき biến âm thành びき.", 6: "ひき biến âm thành ぴき.", 8: "ひき biến âm thành ぴき.", 10: "Cũng đọc là じっぴき." } },
  { id: "bird", label: "Chim", noun: "鳥", nounReading: "とり", counter: "羽", counterReading: "わ", image: "/images/counters/bird.png", usage: "Đếm chim và một số loài có cánh.", readings: ["いちわ", "にわ", "さんわ", "よんわ", "ごわ", "ろくわ", "ななわ", "はちわ", "きゅうわ", "じゅうわ"], notes: { 3: "さんば cũng là biến thể được dùng.", 8: "はっぱ là biến thể của はちわ." } },
  { id: "pencil", label: "Bút chì", noun: "鉛筆", nounReading: "えんぴつ", counter: "本", counterReading: "ほん", image: "/images/counters/pencil.png", usage: "Đếm vật dài, hình trụ như bút chì.", readings: ["いっぽん", "にほん", "さんぼん", "よんほん", "ごほん", "ろっぽん", "ななほん", "はっぽん", "きゅうほん", "じゅっぽん"], notes: { 1: "ほん biến âm thành ぽん.", 3: "ほん biến âm thành ぼん.", 6: "ほん biến âm thành ぽん.", 8: "ほん biến âm thành ぽん.", 10: "Cũng đọc là じっぽん." } },
  { id: "paper", label: "Tờ giấy", noun: "紙", nounReading: "かみ", counter: "枚", counterReading: "まい", image: "/images/counters/paper.png", usage: "Đếm vật mỏng, phẳng như giấy.", readings: ["いちまい", "にまい", "さんまい", "よんまい", "ごまい", "ろくまい", "ななまい", "はちまい", "きゅうまい", "じゅうまい"], notes: {} },
  { id: "book", label: "Quyển sách", noun: "本", nounReading: "ほん", counter: "冊", counterReading: "さつ", image: "/images/counters/book.png", usage: "Đếm sách và ấn phẩm đóng quyển.", readings: ["いっさつ", "にさつ", "さんさつ", "よんさつ", "ごさつ", "ろくさつ", "ななさつ", "はっさつ", "きゅうさつ", "じゅっさつ"], notes: { 1: "さつ biến âm thành っさつ.", 8: "さつ biến âm thành っさつ.", 10: "Cũng đọc là じっさつ." } },
  { id: "car", label: "Xe hơi", noun: "車", nounReading: "くるま", counter: "台", counterReading: "だい", image: "/images/counters/car.png", usage: "Đếm xe và máy móc.", readings: ["いちだい", "にだい", "さんだい", "よんだい", "ごだい", "ろくだい", "ななだい", "はちだい", "きゅうだい", "じゅうだい"], notes: {} },
  { id: "apple", label: "Quả táo", noun: "りんご", nounReading: "りんご", counter: "個", counterReading: "こ", image: "/images/counters/apple.png", usage: "Đếm vật nhỏ, rời; cách đếm chung.", readings: ["いっこ", "にこ", "さんこ", "よんこ", "ごこ", "ろっこ", "ななこ", "はっこ", "きゅうこ", "じゅっこ"], notes: { 1: "こ biến âm thành っこ.", 6: "こ biến âm thành っこ.", 8: "こ biến âm thành っこ.", 10: "Cũng đọc là じっこ." } },
  { id: "glass", label: "Ly", noun: "コップ", nounReading: "こっぷ", counter: "杯", counterReading: "はい", image: "/images/counters/glass.png", usage: "Đếm ly đồ uống.", readings: ["いっぱい", "にはい", "さんばい", "よんはい", "ごはい", "ろっぱい", "ななはい", "はっぱい", "きゅうはい", "じゅっぱい"], notes: { 1: "はい biến âm thành ぱい.", 3: "はい biến âm thành ばい.", 6: "はい biến âm thành ぱい.", 8: "はい biến âm thành ぱい.", 10: "Cũng đọc là じっぱい." } },
  { id: "shoes", label: "Đôi giày", noun: "靴", nounReading: "くつ", counter: "足", counterReading: "そく", image: "/images/counters/shoes.png", usage: "Đếm giày theo đôi.", readings: ["いっそく", "にそく", "さんぞく", "よんそく", "ごそく", "ろくそく", "ななそく", "はっそく", "きゅうそく", "じゅっそく"], notes: { 1: "そく biến âm thành っそく.", 3: "そく biến âm thành ぞく.", 8: "そく biến âm thành っそく.", 10: "Cũng đọc là じっそく." } },
];

export function getCounterResult(id: string, quantity: number): { written: string; reading: string; note: string } | null {
  const object = COUNTER_OBJECTS.find((item) => item.id === id);
  if (!object || !Number.isInteger(quantity) || quantity < 1 || quantity > KANJI_NUMBERS.length) return null;
  return {
    written: `${KANJI_NUMBERS[quantity - 1]}${object.counter}`,
    reading: object.readings[quantity - 1],
    note: object.notes[quantity] ?? "Không có biến âm.",
  };
}
