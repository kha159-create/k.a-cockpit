# 🚀 K.A COCKPIT - Management Dashboard

<div align="center">
  <img src="public/icon-192.png" alt="K.A COCKPIT Logo" width="120" height="120">
  <h3>K.A Management Dashboard - لوحة تحكم إدارة K.A</h3>
  <p>Progressive Web App (PWA) with AI-powered analytics</p>
</div>


## 🎯 **Overview**

K.A COCKPIT is a comprehensive management dashboard built with React, TypeScript, and Firebase. It provides real-time analytics, employee management, store performance tracking, and AI-powered insights.

## ✨ **Features**

### 📊 **Dashboard & Analytics**
- Real-time KPI monitoring
- Interactive charts and graphs
- Performance metrics tracking
- Achievement progress bars

### 👥 **Employee Management**
- Employee 360° view
- Performance tracking
- Sales analytics
- Target achievement monitoring

### 🏪 **Store Management**
- Multi-store performance comparison
- Area-based filtering
- Store detail analytics
- Performance rankings

### 🤖 **AI-Powered Insights**
- Google Gemini AI integration
- Proactive insights and recommendations
- Employee coaching summaries
- Natural language search

### 📱 **Progressive Web App (PWA)**
- Installable on mobile devices
- Offline capability
- Custom app icon
- Native app experience

## 🛠️ **Tech Stack**

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Custom CSS
- **Backend**: Firebase (Auth, Firestore)
- **AI**: Google Gemini API
- **Charts**: Custom Chart Components
- **PWA**: Service Worker, Manifest

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Firebase project
- Google Gemini API key

### **Installation**

1. **Clone the repository**
```bash
git clone https://github.com/kha159-create/k.a-cockpit.git
cd k.a-cockpit
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
Create `.env` file in the root directory:
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Gemini AI API Key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:5173/alsanicockpitv3/`

## 📱 **PWA Installation**

### **Mobile (Android/iPhone)**
1. Open the app in your browser
2. Look for "Add to Home Screen" option
3. Tap "Add" to install

### **Desktop (Windows/Mac)**
1. Open the app in Chrome/Edge
2. Look for the install icon in the address bar
3. Click "Install" to create desktop app

## 🎨 **Customization**

### **Colors & Theme**
The app uses a custom orange theme (`#f97316`). To customize:
- Edit `src/index.css` for color variables
- Modify `tailwind.config.js` for theme colors

### **Components**
- Dashboard components: `src/components/DashboardComponents.tsx`
- Layout: `src/components/MainLayout.tsx`
- Tables: `src/components/Table.tsx`

## 📊 **Data Structure**

### **Firebase Collections**
- `employees` - Employee data and assignments
- `stores` - Store information and performance
- `sales` - Sales transactions
- `metrics` - Performance metrics
- `users` - User management and roles

### **User Roles**
- **Admin**: Full access to all features
- **General Manager**: Store and employee management
- **Area Manager**: Area-specific data access
- **Store Manager**: Store-specific data access
- **Employee**: Limited access to own data

## 🌐 **Internationalization**

The app supports Arabic and English languages:
- Arabic (RTL) - Default
- English (LTR)

Language files are located in:
- `public/locales/ar.json`
- `public/locales/en.json`

## 🤖 **AI Features**

### **Gemini AI Integration**
- Employee coaching summaries
- Proactive insights
- Natural language search
- Performance recommendations

### **AI Components**
- `AiChatAssistant.tsx` - Chat interface
- `AiEmployeeSummaryCard.tsx` - Employee insights
- `ProactiveAiInsightCard.tsx` - Proactive recommendations

## 📈 **Performance**

- **Lighthouse Score**: 90+ PWA score
- **Bundle Size**: Optimized with Vite
- **Loading Speed**: < 2s initial load
- **Offline Support**: Basic offline functionality

## 🔧 **Development**

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### **Project Structure**
```
src/
├── components/      # Reusable UI components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── services/       # API and external services
├── context/        # React context providers
├── types.ts        # TypeScript type definitions
└── utils/          # Utility functions
```

## 🚀 **Deployment**

### **Firebase Hosting**
```bash
npm run build
firebase deploy
```

### **Vercel**
```bash
npm run build
vercel deploy
```

## 📝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 **Team**

- **K.A Team** - Development and Design
- **Khalil Alsani** - Project Lead

## 📞 **Support**

For support, email kha.als@outlook.com  or create an issue in this repository.

## 🙏 **Acknowledgments**

- Firebase for backend services
- Google Gemini for AI capabilities
- React and Vite communities
- Tailwind CSS for styling framework

---

<div align="center">
  <p>Made with ❤️ by khaleel alsani Team</p>
  <p>🚀 <strong>K.A COCKPIT</strong> - Your Management Dashboard Solution</p>
</div>
