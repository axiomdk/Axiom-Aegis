import React, { useState, useRef, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import { GalleryItem } from '../types';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  FileImage,
  Search,
  Filter,
  UserCheck,
  Check,
} from 'lucide-react';
import { InlineCategoryBadge } from './InlineCategoryBadge';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';
import { compressImageToDataUrl } from '../utils/imageCompressor';

export const GalleryView: React.FC = () => {
  const { appData, updateAppData, accent, showNotification } = useVault();

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New photo form state (for single-image detailed modal or batch upload)
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [pendingSizeKb, setPendingSizeKb] = useState<number>(0);
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoTags, setPhotoTags] = useState('');
  const [photoNotes, setPhotoNotes] = useState('');
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split('T')[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const gallery = appData?.gallery || [];
  const activeAvatarDataUrl = appData?.settings?.avatarDataUrl || '';

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of gallery) {
      for (const tag of item.tags || []) {
        if (tag.trim()) tagSet.add(tag.trim());
      }
    }
    return Array.from(tagSet).sort();
  }, [gallery]);

  const filteredGallery = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return gallery.filter((item) => {
      if (
        selectedTag !== 'all' &&
        !(item.tags || []).some((t) => t.toLowerCase() === selectedTag.toLowerCase())
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.date.includes(q) ||
        (item.notes || '').toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [gallery, selectedTag, searchQuery]);

  const isUploadDirty = Boolean(
    isModalOpen &&
      pendingDataUrl &&
      (photoTitle.trim().length > 0 || photoTags.trim().length > 0 || photoNotes.trim().length > 0)
  );

  const uploadModalGuard = useModalGuard({
    isOpen: Boolean(isModalOpen && pendingDataUrl),
    isDirty: isUploadDirty,
    onClose: () => setIsModalOpen(false),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      showNotification('Please select one or more image files (PNG, JPG, WEBP)', 'error');
      return;
    }

    setIsUploading(true);
    try {
      if (files.length === 1) {
        const file = files[0];
        const processed = await compressImageToDataUrl(file, 256, 0.8);
        setPendingDataUrl(processed.dataUrl);
        setPendingSizeKb(processed.sizeKb);
        setPhotoTitle(file.name.replace(/\.[^/.]+$/, ''));
        setIsModalOpen(true);
      } else {
        // Multi-file batch upload directly into Private Gallery with 256x256 @ 0.8 compression
        const todayStr = new Date().toISOString().split('T')[0];
        const createdItems: GalleryItem[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const processed = await compressImageToDataUrl(file, 256, 0.8);
          createdItems.push({
            id: `img-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            title: file.name.replace(/\.[^/.]+$/, '') || `Photo ${i + 1}`,
            dataUrl: processed.dataUrl,
            date: todayStr,
            tags: ['Gallery'],
            sizeKb: processed.sizeKb,
            createdAt: Date.now() + i,
          });
        }
        await updateAppData((prev) => ({
          ...prev,
          gallery: [...createdItems, ...(prev.gallery || [])],
        }));
        showNotification(
          `Compressed & saved ${createdItems.length} images to your Private Gallery!`,
          'success'
        );
      }
    } catch (err) {
      console.error(err);
      showNotification('Error compressing image', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingDataUrl) return;

    const tagsList = photoTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newItem: GalleryItem = {
      id: `img-${Date.now()}`,
      title: photoTitle.trim() || 'Untitled Photo',
      dataUrl: pendingDataUrl,
      date: photoDate,
      tags: tagsList,
      notes: photoNotes.trim() || undefined,
      sizeKb: pendingSizeKb,
      createdAt: Date.now(),
    };

    await updateAppData((prev) => ({
      ...prev,
      gallery: [newItem, ...(prev.gallery || [])],
    }));

    showNotification('Image compressed (≤256px) and saved to Private Gallery!', 'success');
    setIsModalOpen(false);
    setPendingDataUrl(null);
    setPhotoTitle('');
    setPhotoTags('');
    setPhotoNotes('');
  };

  const handleSetAsProfileAvatar = async (item: GalleryItem) => {
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        avatarDataUrl: item.dataUrl,
      },
    }));
    showNotification(`Set "${item.title}" as your active Profile Picture!`, 'success');
  };

  const handleDeletePhoto = async (id: string, title: string, dataUrl?: string) => {
    await updateAppData((prev) => {
      const nextGallery = (prev.gallery || []).filter((item) => item.id !== id);
      const isDeletingActiveAvatar =
        dataUrl && prev.settings?.avatarDataUrl === dataUrl;
      return {
        ...prev,
        gallery: nextGallery,
        settings: isDeletingActiveAvatar
          ? {
              ...prev.settings,
              avatarDataUrl: nextGallery[0]?.dataUrl || '',
            }
          : prev.settings,
      };
    });
    showNotification(`Photo "${title}" removed from Private Gallery.`, 'info');
    if (lightboxIndex !== null) setLightboxIndex(null);
  };

  const handleDownloadDecrypted = (item: GalleryItem) => {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = `${item.title.toLowerCase().replace(/\s+/g, '-')}-${item.date}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeLightboxItem =
    lightboxIndex !== null && filteredGallery[lightboxIndex]
      ? filteredGallery[lightboxIndex]
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ImageIcon className="w-5 h-5" style={{ color: accent.hex }} />
            Private Gallery &amp; Profile Avatar Vault
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Client-side Canvas compression (max 256×256px @ 0.8 quality) • Click any image to set as your active Forum Profile Avatar
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            data-testid="gallery-upload-input"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            data-testid="gallery-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer ${accent.primaryBg}`}
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? 'Compressing...' : '+ Upload Images'}</span>
          </button>
        </div>
      </div>

      {/* Unified Tag & Search Filter Bar */}
      {gallery.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#000000] border border-[#1E222B] rounded-xl">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-1 mr-0.5" />
            <button
              type="button"
              onClick={() => setSelectedTag('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border shrink-0 transition-colors ${
                selectedTag === 'all'
                  ? 'bg-[#121620] text-white border-[#232732] font-bold'
                  : 'bg-[#000000] text-zinc-400 border-[#1E222B] hover:text-white'
              }`}
              style={selectedTag === 'all' ? { color: accent.hex } : undefined}
            >
              All ({gallery.length})
            </button>
            {allTags.map((tag) => (
              <InlineCategoryBadge
                key={tag}
                domain="gallery"
                category={tag}
                prefix="#"
                size="xs"
                isSelected={selectedTag.toLowerCase() === tag.toLowerCase()}
                onSelect={() =>
                  setSelectedTag((prev) =>
                    prev.toLowerCase() === tag.toLowerCase() ? 'all' : tag
                  )
                }
                onRenamed={(oldName, newName) => {
                  if (selectedTag.toLowerCase() === oldName.toLowerCase()) {
                    setSelectedTag(newName);
                  }
                }}
                className="font-mono shrink-0"
              />
            ))}
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              data-testid="gallery-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, date (YYYY-MM-DD), #tag..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#090B10] border border-[#1E222B] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Gallery Grid */}
      {filteredGallery.length === 0 ? (
        <div className="p-16 text-center bg-[#000000] border border-[#1E222B] rounded-2xl space-y-4">
          <FileImage className="w-10 h-10 text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-200">
              {gallery.length === 0
                ? 'No images in your Private Gallery yet'
                : 'No photos match your active filter'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              {gallery.length === 0
                ? 'Upload one or multiple images. All images are automatically compressed client-side (≤256×256px) and can be selected as your Forum Profile Avatar.'
                : 'Try clearing the search query or selecting All tags.'}
            </p>
          </div>
          {gallery.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-[#1E222B] text-xs text-white font-semibold shadow cursor-pointer"
            >
              + Upload Your First Image
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelectedTag('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-[#1E222B] text-xs text-white font-semibold shadow cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredGallery.map((item, index) => {
            const isActiveAvatar = activeAvatarDataUrl === item.dataUrl;
            return (
              <div
                key={item.id}
                data-testid={`gallery-card-${item.id}`}
                className={`group rounded-2xl bg-[#000000] border overflow-hidden shadow-lg flex flex-col justify-between transition-all ${
                  isActiveAvatar
                    ? 'border-cyan-400 ring-1 ring-cyan-400/40'
                    : 'border-[#1E222B] hover:border-zinc-700'
                }`}
              >
                {/* Image Thumbnail Container */}
                <div
                  className="relative aspect-4/3 overflow-hidden bg-black cursor-pointer"
                  onClick={() => handleSetAsProfileAvatar(item)}
                  title="Click image to set as your active Profile Picture"
                >
                  <img
                    src={item.dataUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {isActiveAvatar && (
                    <div
                      data-testid={`gallery-active-avatar-badge-${item.id}`}
                      className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-cyan-500 text-black text-[10px] font-mono font-extrabold uppercase flex items-center gap-1 shadow-lg"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Active Avatar</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                    <span className="text-[10px] text-zinc-300 font-mono tabular-nums">
                      {item.sizeKb} KB
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex(index);
                      }}
                      title="Inspect full image"
                      className="p-1.5 rounded-lg bg-zinc-900/90 text-white hover:bg-zinc-800 backdrop-blur"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Caption & Metadata */}
                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-1.5">
                      <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                      <button
                        type="button"
                        data-testid={`gallery-delete-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(item.id, item.title, item.dataUrl);
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400 shrink-0 cursor-pointer"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {item.notes && (
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{item.notes}</p>
                    )}
                  </div>

                  {/* Set as Profile Avatar Action Button */}
                  <button
                    type="button"
                    data-testid={`gallery-set-avatar-${item.id}`}
                    onClick={() => handleSetAsProfileAvatar(item)}
                    className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-mono font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isActiveAvatar
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                        : 'bg-[#090B10] hover:bg-[#121620] text-zinc-300 hover:text-white border-[#1E222B]'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isActiveAvatar ? 'Active Profile Picture' : 'Set as Profile Picture'}</span>
                  </button>

                  <div className="pt-2 border-t border-[#1E222B] flex items-center justify-between text-[10px] text-zinc-500 font-mono tabular-nums">
                    <span>{item.date}</span>
                    <div
                      className="flex gap-1 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.tags.slice(0, 2).map((tag) => (
                        <InlineCategoryBadge
                          key={tag}
                          domain="gallery"
                          category={tag}
                          prefix="#"
                          size="xs"
                          className="bg-zinc-900 text-zinc-400 border-zinc-800 truncate font-mono"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Details Modal */}
      {isModalOpen && pendingDataUrl && (
        <div
          onDoubleClick={uploadModalGuard.handleBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1E222B] mb-4">
              <h3 className="text-sm font-bold text-white">Save Compressed Image ({pendingSizeKb} KB)</h3>
              <button
                type="button"
                onClick={uploadModalGuard.requestExplicitClose}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnsavedChangesBanner
              isOpen={uploadModalGuard.showConfirmClose}
              onKeepEditing={uploadModalGuard.cancelClose}
              onDiscardAndClose={uploadModalGuard.confirmDiscardAndClose}
            />

            <form onSubmit={handleSavePhoto} className="space-y-4">
              <div className="aspect-16/9 rounded-xl overflow-hidden bg-black border border-[#1E222B]">
                <img src={pendingDataUrl} alt="Preview" className="w-full h-full object-contain" />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={photoTitle}
                  onChange={(e) => setPhotoTitle(e.target.value)}
                  placeholder="Photo Title"
                  className="w-full px-3 py-2 bg-[#090B10] border border-[#1E222B] rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={photoDate}
                    onChange={(e) => setPhotoDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090B10] border border-[#1E222B] rounded-lg text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={photoTags}
                    onChange={(e) => setPhotoTags(e.target.value)}
                    placeholder="Avatar, Emblem, Milestone"
                    className="w-full px-3 py-2 bg-[#090B10] border border-[#1E222B] rounded-lg text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={photoNotes}
                  onChange={(e) => setPhotoNotes(e.target.value)}
                  placeholder="Location, context, or private memory notes..."
                  className="w-full px-3 py-2 bg-[#090B10] border border-[#1E222B] rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={uploadModalGuard.requestExplicitClose}
                  className="flex-1 py-2 rounded-lg bg-zinc-900 border border-[#1E222B] text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="gallery-confirm-save-btn"
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold ${accent.primaryBg}`}
                >
                  Save to Gallery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Viewer */}
      {activeLightboxItem && lightboxIndex !== null && (
        <div
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget) {
              setLightboxIndex(null);
            }
          }}
          className="fixed inset-0 z-60 bg-black/95 flex flex-col justify-between p-4 sm:p-6 backdrop-blur-md"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between text-white pb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-bold">{activeLightboxItem.title}</h3>
              <p className="text-[11px] text-zinc-400 font-mono tabular-nums">
                {activeLightboxItem.date} • {activeLightboxItem.sizeKb} KB • Compressed WebP/JPEG
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSetAsProfileAvatar(activeLightboxItem)}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>Set as Profile Picture</span>
              </button>
              <button
                onClick={() => handleDownloadDecrypted(activeLightboxItem)}
                className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white"
                title="Download Image"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  handleDeletePhoto(
                    activeLightboxItem.id,
                    activeLightboxItem.title,
                    activeLightboxItem.dataUrl
                  )
                }
                className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                title="Delete Photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Central Image with Next/Previous Controls */}
          <div
            onDoubleClick={(e) => {
              if (e.target === e.currentTarget) {
                setLightboxIndex(null);
              }
            }}
            className="relative flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden"
          >
            <img
              src={activeLightboxItem.dataUrl}
              alt={activeLightboxItem.title}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            />

            {filteredGallery.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev !== null && prev > 0 ? prev - 1 : filteredGallery.length - 1
                    )
                  }
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev !== null && prev < filteredGallery.length - 1 ? prev + 1 : 0
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Bar Details */}
          {activeLightboxItem.notes && (
            <div className="max-w-xl mx-auto p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 text-center">
              "{activeLightboxItem.notes}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
