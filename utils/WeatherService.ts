export interface WeatherData {
  now: {
    temp: string;
    feelsLike: string;
    code: string;
    text: string;
    windDir: string;
    windScale: string;
    humidity: string;
    precip: string;
    pressure: string;
    vis: string;
    cloud?: string;
    dewPoint?: string;
  };
  daily?: Array<{
    date: string;
    tempMax: string;
    tempMin: string;
    textDay: string;
    windDirDay: string;
    windScaleDay: string;
    humidity: string;
    precip: string;
  }>;
}

class WeatherService {
  // 获取天气图标
  static getWeatherIcon(code: string): string {
    const codeNum = parseInt(code);
    
    if (codeNum === 100) return 'wb-sunny';
    if (codeNum >= 101 && codeNum <= 103) return 'cloud';
    if (codeNum === 104) return 'wb-cloudy';
    if (codeNum >= 200 && codeNum <= 213) return 'air';
    if (codeNum >= 300 && codeNum <= 313) return 'water';
    if (codeNum >= 400 && codeNum <= 410) return 'ac-unit';
    if (codeNum >= 500 && codeNum <= 515) return 'blur-on';
    
    return 'wb-cloudy';
  }

  // 获取天气建议
  static getWeatherSuggestion(weather: WeatherData): string {
    const codeNum = parseInt(weather.now.code);
    const temp = parseInt(weather.now.temp);
    
    if (codeNum >= 300 && codeNum <= 313) {
      return '雨天路滑，巡查时请注意安全';
    }
    if (codeNum >= 400 && codeNum <= 410) {
      return '雪天路滑，请谨慎巡查';
    }
    if (codeNum >= 500 && codeNum <= 515) {
      return '雾天能见度低，请注意安全';
    }
    if (temp > 35) {
      return '高温天气，请注意防暑降温';
    }
    if (temp < 0) {
      return '天气寒冷，请注意保暖';
    }
    
    return '天气良好，适合巡查';
  }

  // 获取天气数据（模拟数据）
  static async getWeather(): Promise<WeatherData> {
    // 在实际应用中，这里应该调用真实的天气API
    // 目前返回模拟数据
    return {
      now: {
        temp: '22',
        feelsLike: '20',
        code: '101',
        text: '多云',
        windDir: '东北风',
        windScale: '2',
        humidity: '65',
        precip: '0.0',
        pressure: '1013',
        vis: '10',
        cloud: '60'
      }
    };
  }
}

export default WeatherService;