import React from 'react';
import { CurrencyDollarIcon, ReceiptTaxIcon, ScaleIcon, UsersIcon } from '../components/Icons';
import AnimatedCard from './AnimatedCard';

const AnimatedCardDemo: React.FC = () => {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-800 mb-8 text-center">
          Animated Card Design Demo
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <AnimatedCard
            title="Total Sales"
            value="1,234,567"
            subtitle="SAR"
            icon={<CurrencyDollarIcon />}
            onClick={() => console.log('Sales card clicked')}
          />
          
          <AnimatedCard
            title="Transactions"
            value="8,432"
            subtitle="Count"
            icon={<ReceiptTaxIcon />}
            onClick={() => console.log('Transactions card clicked')}
          />
          
          <AnimatedCard
            title="Conversion Rate"
            value="12.5%"
            subtitle="Average"
            icon={<ScaleIcon />}
            onClick={() => console.log('Conversion card clicked')}
          />
          
          <AnimatedCard
            title="Active Users"
            value="156"
            subtitle="Current"
            icon={<UsersIcon />}
            onClick={() => console.log('Users card clicked')}
          />
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-xl font-semibold text-zinc-700 mb-4">Card Features</h2>
          <ul className="space-y-2 text-zinc-600">
            <li>• Animated gradient background with orange theme</li>
            <li>• Moving dot animation around the card perimeter</li>
            <li>• Glowing ray effect in the top-left corner</li>
            <li>• Gradient lines on all sides</li>
            <li>• Responsive design for mobile devices</li>
            <li>• Click interaction support</li>
            <li>• Customizable content (title, value, subtitle, icon)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnimatedCardDemo;
