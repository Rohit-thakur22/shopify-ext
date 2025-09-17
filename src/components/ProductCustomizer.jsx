import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, Image, filters } from 'fabric';
import hoodiePng from '../assets/hoodie.png';

const COLOR_SWATCHES = [
  '#000000',
  '#ffffff',
  '#e11d48',
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#7c3aed',
  '#6b7280',
];

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 560;

const ProductCustomizer = () => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const hoodieRef = useRef(null);
  const fileInputRef = useRef(null);
  const [tintColor, setTintColor] = useState('#6b7280');

  const initializeCanvas = useCallback(() => {
    if (fabricRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
    });
    fabricRef.current = canvas;

    Image.fromURL(hoodiePng, { crossOrigin: 'anonymous' }).then((img) => {
      // Center and scale hoodie to fit canvas nicely
      const maxWidth = CANVAS_WIDTH * 0.8;
      const scale = Math.min(maxWidth / img.width, CANVAS_HEIGHT * 0.9 / img.height);
      img.set({
        left: CANVAS_WIDTH / 2,
        top: CANVAS_HEIGHT / 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        scaleX: scale,
        scaleY: scale,
      });

      // Apply initial color tint while preserving highlights/shadows
      img.filters = [new filters.BlendColor({ color: tintColor, mode: 'tint', alpha: 1 })];
      img.applyFilters();

      hoodieRef.current = img;
      canvas.add(img);
      canvas.requestRenderAll();

      // Add a default logo placeholder group (hidden until user adds logo)
    });
  }, [tintColor]);

  useEffect(() => {
    initializeCanvas();
    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
        hoodieRef.current = null;
      }
    };
  }, [initializeCanvas]);

  const changeColor = useCallback((color) => {
    setTintColor(color);
    if (!hoodieRef.current) return;
    hoodieRef.current.filters = [new filters.BlendColor({ color, mode: 'tint', alpha: 1 })];
    hoodieRef.current.applyFilters();
    fabricRef.current.requestRenderAll();
  }, []);

  const addLogoFromUrl = useCallback((url) => {
    if (!fabricRef.current || !hoodieRef.current || !url) return;
    Image.fromURL(url, { crossOrigin: 'anonymous' }).then((img) => {
      const canvas = fabricRef.current;

      // default logo width about 25% of hoodie width
      const hoodiePixelWidth = hoodieRef.current.getScaledWidth();
      const targetWidth = hoodiePixelWidth * 0.25;
      const scale = targetWidth / img.width;

      img.set({
        originX: 'center',
        originY: 'center',
        left: hoodieRef.current.left,
        top: hoodieRef.current.top - hoodieRef.current.getScaledHeight() * 0.12, // chest area
        selectable: true,
        evented: true,
        cornerStyle: 'circle',
        transparentCorners: false,
      });
      img.scale(scale);

      // Restrict logo movement roughly within hoodie bounds
      img.on('moving', () => {
        const bounds = hoodieRef.current.getBoundingRect(true, true);
        const objRect = img.getBoundingRect(true, true);
        const padding = 10;
        if (objRect.left < bounds.left + padding) img.left = bounds.left + padding + objRect.width / 2;
        if (objRect.top < bounds.top + padding) img.top = bounds.top + padding + objRect.height / 2;
        if (objRect.left + objRect.width > bounds.left + bounds.width - padding) img.left = bounds.left + bounds.width - padding - objRect.width / 2;
        if (objRect.top + objRect.height > bounds.top + bounds.height - padding) img.top = bounds.top + bounds.height - padding - objRect.height / 2;
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
    });
  }, []);

  const addLogo = useCallback((fileOrUrl) => {
    if (!fileOrUrl) return;
    if (typeof fileOrUrl === 'string') {
      addLogoFromUrl(fileOrUrl);
      return;
    }
    const file = fileOrUrl;
    const reader = new FileReader();
    reader.onload = (e) => addLogoFromUrl(e.target.result);
    reader.readAsDataURL(file);
  }, [addLogoFromUrl]);

  const exportDesign = useCallback(() => {
    if (!fabricRef.current) return '';
    // Export at 2x for better quality
    return fabricRef.current.toDataURL({ format: 'png', multiplier: 2, enableRetinaScaling: true });
  }, []);

  const onClickAddLogo = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) addLogo(file);
    // reset so the same file can be selected again
    e.target.value = '';
  }, [addLogo]);

  const onExport = useCallback(() => {
    const data = exportDesign();
    if (!data) return;
    // trigger download
    const link = document.createElement('a');
    link.href = data;
    link.download = 'hoodie-design.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [exportDesign]);

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 w-full flex items-center justify-center">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <canvas ref={canvasRef} />
        </div>
      </div>
      <div className="lg:col-span-4">
        <div className="bg-white border rounded-xl p-4 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Color</h3>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((color) => (
                <button
                  key={color}
                  aria-label={`Color ${color}`}
                  className={`h-8 w-8 rounded-md border ${tintColor === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => changeColor(color)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Logo</h3>
            <div className="flex items-center gap-3">
              <button
                className="px-3 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
                onClick={onClickAddLogo}
              >
                Add Logo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </div>

          <div>
            <button
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500"
              onClick={onExport}
            >
              Export PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCustomizer;


