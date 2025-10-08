const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

// SVG content
const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f97316;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ea580c;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- خلفية دائرية -->
  <circle cx="256" cy="256" r="240" fill="url(#logoGradient)" stroke="#ffffff" stroke-width="8"/>
  
  <!-- حرف K -->
  <path d="M 180 120 L 180 380 L 220 380 L 220 280 L 280 380 L 340 380 L 260 260 L 340 140 L 280 140 L 220 240 L 220 140 L 180 140 Z" fill="#ffffff"/>
  
  <!-- نقطة A -->
  <circle cx="380" cy="380" r="30" fill="#ffffff"/>
</svg>`;

async function generateIcons() {
    try {
        // Create 512x512 icon
        const canvas512 = createCanvas(512, 512);
        const ctx512 = canvas512.getContext('2d');
        
        // Draw background circle
        ctx512.fillStyle = '#f97316';
        ctx512.beginPath();
        ctx512.arc(256, 256, 240, 0, 2 * Math.PI);
        ctx512.fill();
        
        // Draw white border
        ctx512.strokeStyle = '#ffffff';
        ctx512.lineWidth = 8;
        ctx512.stroke();
        
        // Draw K letter
        ctx512.fillStyle = '#ffffff';
        ctx512.font = 'bold 200px Arial';
        ctx512.textAlign = 'center';
        ctx512.textBaseline = 'middle';
        ctx512.fillText('K', 200, 256);
        
        // Draw A dot
        ctx512.beginPath();
        ctx512.arc(380, 380, 30, 0, 2 * Math.PI);
        ctx512.fill();
        
        // Save 512x512
        const buffer512 = canvas512.toBuffer('image/png');
        fs.writeFileSync('public/icon-512.png', buffer512);
        
        // Create 192x192 icon
        const canvas192 = createCanvas(192, 192);
        const ctx192 = canvas192.getContext('2d');
        
        // Draw background circle
        ctx192.fillStyle = '#f97316';
        ctx192.beginPath();
        ctx192.arc(96, 96, 90, 0, 2 * Math.PI);
        ctx192.fill();
        
        // Draw white border
        ctx192.strokeStyle = '#ffffff';
        ctx192.lineWidth = 3;
        ctx192.stroke();
        
        // Draw K letter
        ctx192.fillStyle = '#ffffff';
        ctx192.font = 'bold 75px Arial';
        ctx192.textAlign = 'center';
        ctx192.textBaseline = 'middle';
        ctx192.fillText('K', 75, 96);
        
        // Draw A dot
        ctx192.beginPath();
        ctx192.arc(142, 142, 11, 0, 2 * Math.PI);
        ctx192.fill();
        
        // Save 192x192
        const buffer192 = canvas192.toBuffer('image/png');
        fs.writeFileSync('public/icon-192.png', buffer192);
        
        // Create 180x180 icon (Apple Touch Icon)
        const canvas180 = createCanvas(180, 180);
        const ctx180 = canvas180.getContext('2d');
        
        // Draw background circle
        ctx180.fillStyle = '#f97316';
        ctx180.beginPath();
        ctx180.arc(90, 90, 85, 0, 2 * Math.PI);
        ctx180.fill();
        
        // Draw white border
        ctx180.strokeStyle = '#ffffff';
        ctx180.lineWidth = 3;
        ctx180.stroke();
        
        // Draw K letter
        ctx180.fillStyle = '#ffffff';
        ctx180.font = 'bold 70px Arial';
        ctx180.textAlign = 'center';
        ctx180.textBaseline = 'middle';
        ctx180.fillText('K', 70, 90);
        
        // Draw A dot
        ctx180.beginPath();
        ctx180.arc(133, 133, 10, 0, 2 * Math.PI);
        ctx180.fill();
        
        // Save 180x180
        const buffer180 = canvas180.toBuffer('image/png');
        fs.writeFileSync('public/apple-touch-icon.png', buffer180);
        
        console.log('✅ تم إنشاء جميع الأيقونات بنجاح!');
        console.log('📱 icon-512.png (512x512)');
        console.log('📱 icon-192.png (192x192)');
        console.log('🍎 apple-touch-icon.png (180x180)');
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء الأيقونات:', error);
    }
}

generateIcons();
