import React from 'react';

interface Achievement {
  icon: string;
  title: string;
  event: string;
  year: string;
}

interface AchievementsSectionProps {
  achievements: Achievement[];
}

const AchievementsSection: React.FC<AchievementsSectionProps> = ({ achievements }) => {
  if (!achievements || achievements.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🏆 Achievements</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {achievements.map((achievement, index) => (
          <div 
            key={index} 
            className="flex items-start space-x-4 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl hover:shadow-md transition-shadow"
          >
            <div className="text-4xl">{achievement.icon}</div>
            <div>
              <h3 className="font-semibold text-gray-900">{achievement.title}</h3>
              <p className="text-sm text-gray-600">{achievement.event}</p>
              <p className="text-xs text-gray-500 mt-1">{achievement.year}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AchievementsSection;