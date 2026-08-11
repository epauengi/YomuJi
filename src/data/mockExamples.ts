import type { Example } from '@/types';

export const mockExamples: Example[] = [
  {
    id: 'example-nihon-1',
    surface: '日本人は桜が好きです。',
    reading: 'にほんじんはさくらがすきです。',
    translation: 'Người Nhật thích hoa anh đào.',
    note: 'Cấu trúc: [Danh từ] は [Danh từ] が [Tính từ/Động từ]'
  },
  {
    id: 'example-taberu-1',
    surface: '朝ごはんを食べます。',
    reading: 'あさごはんをたべます。',
    translation: 'Tôi ăn cơm sáng.',
    note: 'Trợ từ を đánh dấu đối tượng của động từ ăn'
  },
  {
    id: 'example-omoshiroi-1',
    surface: 'この映画は面白いです。',
    reading: 'このえいがはおもしろいです。',
    translation: 'Bộ phim này thú vị.',
    note: 'Dùng với danh từ: この + [danh từ] は + [tính từ] です'
  },
  {
    id: 'example-manabu-1',
    surface: '日本語を勉強するために日本に行きます。',
    reading: 'にほんごをべんきょうするためににほんにいきます。',
    translation: 'Tôi đi Nhật để học tiếng Nhật.',
    note: 'Mẫu câu chỉ mục đích: ために = vì, để'
  },
  {
    id: 'example-benkyou-1',
    surface: '毎日勉強します。',
    reading: 'まいにちべんきょうします。',
    translation: 'Tôi học bài mỗi ngày.',
    note: '毎日 (まいにち) = mỗi ngày, hàng ngày'
  }
];