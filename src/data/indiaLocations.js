/**
 * India states / UTs and their major education-hub cities.
 * Used for the Explore page location dropdowns so we can match nearby colleges.
 * City lists focus on cities that actually have colleges/universities.
 */
export const INDIA_STATES = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore', 'Kakinada'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Durg'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Anand'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Hisar', 'Kurukshetra', 'Sonipat'],
  'Himachal Pradesh': ['Shimla', 'Mandi', 'Solan', 'Hamirpur'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli-Dharwad', 'Belagavi', 'Manipal', 'Davangere'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kottayam'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Kolhapur', 'Navi Mumbai'],
  'Manipur': ['Imphal'],
  'Meghalaya': ['Shillong'],
  'Mizoram': ['Aizawl'],
  'Nagaland': ['Kohima', 'Dimapur'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur', 'Berhampur'],
  'Punjab': ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Mohali', 'Phagwara'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Pilani'],
  'Sikkim': ['Gangtok'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Vellore', 'Salem', 'Thanjavur'],
  'Telangana': ['Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad'],
  'Tripura': ['Agartala'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Varanasi', 'Prayagraj', 'Agra', 'Aligarh', 'Bareilly'],
  'Uttarakhand': ['Dehradun', 'Roorkee', 'Haridwar', 'Nainital'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Kharagpur', 'Asansol'],
  // Union Territories
  'Delhi (NCT)': ['New Delhi', 'Delhi'],
  'Jammu & Kashmir': ['Srinagar', 'Jammu'],
  'Chandigarh': ['Chandigarh'],
  'Puducherry': ['Puducherry'],
  'Andaman & Nicobar': ['Port Blair'],
  'Ladakh': ['Leh'],
}

export const STATE_NAMES = Object.keys(INDIA_STATES).sort()

export function citiesForState(state) {
  return INDIA_STATES[state] || []
}
