'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpenText,
  CheckCircle,
  CircleNotch,
  ClockCounterClockwise,
  Copy,
  Gear,
  Info,
  Layout,
  Lightning,
  MagnifyingGlass,
  Palette,
  Trash,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { mockUIStates } from '@/data/mockData';

export default function ShowcasePage() {
  const [activeSection, setActiveSection] = useState('colors');

  const sections = [
    { id: 'colors', label: 'Màu sắc', icon: Palette },
    { id: 'components', label: 'Component', icon: Layout },
    { id: 'states', label: 'Trạng thái', icon: Lightning },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      {/* Header */}
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Palette className="w-6 h-6 text-[var(--color-primary-600)]" />
            <h1 className="text-2xl font-bold">Component Showcase</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            Thư viện trạng thái component và hệ thống thiết kế của YomuJi
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Section Navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === section.id
                    ? 'bg-[var(--color-primary-600)] text-white shadow-md'
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="space-y-12">
          {activeSection === 'colors' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Primary Palette */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Primary Palette (Teal)</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map((shade) => (
                    <div key={shade} className="group">
                      <div 
                        className="h-16 rounded-lg border border-[var(--color-border)] mb-2 transition-transform group-hover:scale-105" 
                        style={{ backgroundColor: `var(--primary-${shade})` }}
                      />
                      <div className="text-xs font-mono text-center text-[var(--color-text-muted)]">
                        primary-{shade}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Semantic Colors */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Semantic Colors</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/20">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Success State</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]/20">
                      <WarningCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Warning State</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error)]/20">
                      <XCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Error State</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]/20">
                      <Info className="h-5 w-5" />
                      <span className="text-sm font-medium">Info State</span>
                    </div>
                  </div>
                  <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
                    <h4 className="text-sm font-medium mb-4 text-[var(--color-text-secondary)]">JLPT Badges</h4>
                    <div className="flex flex-wrap gap-3">
                      <Badge variant="jlpt" jlptLevel="N5">N5</Badge>
                      <Badge variant="jlpt" jlptLevel="N4">N4</Badge>
                      <Badge variant="jlpt" jlptLevel="N3">N3</Badge>
                      <Badge variant="jlpt" jlptLevel="N2">N2</Badge>
                      <Badge variant="jlpt" jlptLevel="N1">N1</Badge>
                    </div>
                  </div>
                </div>
              </section>

              {/* Surface Colors */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Surface & Text</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
                    <div className="text-sm text-[var(--color-text-primary)] font-medium mb-1">Background</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">--color-background</div>
                  </div>
                  <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <div className="text-sm text-[var(--color-text-primary)] font-medium mb-1">Surface</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">--color-surface</div>
                  </div>
                  <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                    <div className="text-sm text-[var(--color-text-primary)] font-medium mb-1">Surface Subtle</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">--color-surface-subtle</div>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {activeSection === 'components' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              {/* Buttons */}
              <section>
                <h3 className="text-lg font-semibold mb-6">Buttons</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Primary</span>
                    <div className="flex flex-col gap-3">
                      <Button variant="primary" size="medium">Medium Button</Button>
                      <Button variant="primary" size="small">Small Button</Button>
                      <Button variant="primary" size="large">Large Button</Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Secondary</span>
                    <div className="flex flex-col gap-3">
                      <Button variant="secondary" size="medium">Secondary</Button>
                      <Button variant="secondary" size="small">Secondary</Button>
                      <Button variant="secondary" size="large">Secondary</Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Ghost / Link</span>
                    <div className="flex flex-col gap-3">
                      <Button variant="ghost" size="medium">Ghost Button</Button>
                      <Button variant="link" size="medium">Link Button</Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Destructive</span>
                    <div className="flex flex-col gap-3">
                      <Button variant="danger" size="md">Delete Action</Button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Inputs */}
              <section>
                <h3 className="text-lg font-semibold mb-6">Form Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Default Input</label>
                      <Input placeholder="Nhập từ cần tra..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Focus State</label>
                      <Input defaultValue="Đang focus..." className="ring-2 ring-[var(--color-primary-500)] border-[var(--color-primary-500)]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Error State</label>
                      <Input placeholder="Sai định dạng..." className="border-red-500 focus:ring-red-500" />
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <WarningCircle className="h-3 w-3" /> Vui lòng nhập đúng định dạng.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Search Input (Compact)</label>
                      <div className="relative">
                        <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <Input className="pl-10" placeholder="Tìm kiếm nhanh..." />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Search Input (Hero)</label>
                      <div className="relative">
                        <MagnifyingGlass className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <Input className="pl-12 h-14 text-lg" placeholder="Khám phá tiếng Nhật..." />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Cards */}
              <section>
                <h3 className="text-lg font-semibold mb-6">Cards & Containers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-6">
                    <h4 className="font-bold mb-2">Default Card</h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Sử dụng border subtle, không shadow. Phù hợp cho nội dung tĩnh.
                    </p>
                  </Card>
                  <Card className="p-6 border-[var(--color-primary-300)] bg-[var(--color-primary-50)]">
                    <h4 className="font-bold mb-2 text-[var(--color-primary-800)]">Active Card</h4>
                    <p className="text-sm text-[var(--color-primary-700)]">
                      Trạng thái khi được chọn hoặc highlight.
                    </p>
                  </Card>
                  <Card className="p-6 opacity-60 grayscale">
                    <h4 className="font-bold mb-2">Disabled Card</h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Trạng thái không khả dụng.
                    </p>
                  </Card>
                </div>
              </section>
            </motion.div>
          )}

          {activeSection === 'states' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              {/* Loading States */}
              <section>
                <h3 className="text-lg font-semibold mb-6">Loading States</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl space-y-4">
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase">Spinner</span>
                    <div className="flex justify-center py-8">
                      <CircleNotch className="h-8 w-8 animate-spin text-[var(--color-primary-600)]" />
                    </div>
                  </div>
                  <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl space-y-4">
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase">Skeleton Card</span>
                    <div className="space-y-3">
                      <div className="h-4 bg-[var(--color-surface-muted)] rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-[var(--color-surface-muted)] rounded w-1/2 animate-pulse" />
                      <div className="h-20 bg-[var(--color-surface-muted)] rounded w-full animate-pulse" />
                    </div>
                  </div>
                  <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl space-y-4">
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase">Progress Bar</span>
                    <div className="w-full bg-[var(--color-surface-muted)] h-2 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: '0%' }}
                        animate={{ width: '65%' }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="h-full bg-[var(--color-primary-600)]"
                      />
                    </div>
                    <div className="text-center text-xs text-[var(--color-text-muted)]">Đang tải dữ liệu...</div>
                  </div>
                </div>
              </section>

              {/* Empty States */}
              <section>
                <h3 className="text-lg font-semibold mb-6">Empty States</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-center space-y-4">
                    <div className="w-16 h-16 bg-[var(--color-surface-subtle)] rounded-full flex items-center justify-center mx-auto">
                      <MagnifyingGlass className="h-8 w-8 text-[var(--color-text-muted)]" />
                    </div>
                    <div>
                      <div className="font-bold">Không tìm thấy kết quả</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">Thử thay đổi từ khóa tìm kiếm của bạn.</div>
                    </div>
                    <Button variant="primary" size="small">Thử từ mẫu</Button>
                  </div>
                  <div className="p-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-center space-y-4">
                    <div className="w-16 h-16 bg-[var(--color-surface-subtle)] rounded-full flex items-center justify-center mx-auto">
                      <ClockCounterClockwise className="h-8 w-8 text-[var(--color-text-muted)]" />
                    </div>
                    <div>
                      <div className="font-bold">Lịch sử trống</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">Bạn chưa có lượt tra cứu nào gần đây.</div>
                    </div>
                    <Button variant="secondary" size="small">Bắt đầu tra từ</Button>
                  </div>
                  <div className="p-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-center space-y-4">
                    <div className="w-16 h-16 bg-[var(--color-surface-subtle)] rounded-full flex items-center justify-center mx-auto">
                      <BookOpenText className="h-8 w-8 text-[var(--color-text-muted)]" />
                    </div>
                    <div>
                      <div className="font-bold">Danh sách trống</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">Bạn chưa lưu từ vựng nào vào bộ sưu tập.</div>
                    </div>
                    <Button variant="primary" size="small">Tra từ 日本</Button>
                  </div>
                </div>
              </section>

              {/* Feedback States */}
              <section>
                <h3 className="text-lg font-semibold mb-6">Feedback & Toasts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase">Success Toasts</span>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 p-3 bg-white border-l-4 border-[var(--color-success)] shadow-sm rounded-r-lg animate-in slide-in-from-right">
                        <CheckCircle className="h-4 w-4 text-[var(--color-success)]" />
                        <span className="text-sm">Đã lưu từ vựng thành công!</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white border-l-4 border-[var(--color-success)] shadow-sm rounded-r-lg animate-in slide-in-from-right">
                        <Copy className="h-4 w-4 text-[var(--color-success)]" />
                        <span className="text-sm">Đã sao chép vào bộ nhớ tạm.</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase">Error Toasts</span>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 p-3 bg-white border-l-4 border-[var(--color-error)] shadow-sm rounded-r-lg animate-in slide-in-from-right">
                        <XCircle className="h-4 w-4 text-[var(--color-error)]" />
                        <span className="text-sm">Lỗi kết nối mạng. Vui lòng thử lại.</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white border-l-4 border-[var(--color-error)] shadow-sm rounded-r-lg animate-in slide-in-from-right">
                        <WarningCircle className="h-4 w-4 text-[var(--color-error)]" />
                        <span className="text-sm">Không thể xóa mục này.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
