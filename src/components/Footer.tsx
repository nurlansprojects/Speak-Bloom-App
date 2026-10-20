import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-[#ECEAF2] bg-white py-6 mb-16 md:mb-0 px-4 sm:px-8 text-center text-xs text-[#7B788A]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#181622]">Speak Bloom</span>
          <span className="text-[#A29EAF]">•</span>
          <span>Bloom's Taxonomy English Speaking Platform</span>
        </div>
        <div className="font-medium text-[#484556]">
          Copyrighted — Jamalova Ummikhabiba
        </div>
      </div>
    </footer>
  );
};
