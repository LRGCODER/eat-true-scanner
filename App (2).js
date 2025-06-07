import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import Tesseract from 'tesseract.js';
import Quagga from 'quagga';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-500 text-white rounded-md m-4">
          <h2>Something went wrong.</h2>
          <p>{this.state.error?.message || 'Unknown error'}</p>
          <button
            className="p-2 bg-gray-700 rounded-md mt-2"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// State reducer
const initialState = {
  view: 'home',
  userProfile: { age: 30, dietaryPreferences: [], pregnancyStatus: 'not_pregnant' },
  ingredients: [],
  batchResults: [],
  analysis: null,
  loading: false,
  scanHistory: [],
  manualInput: '',
  selectedIngredient: null,
  ratings: [],
  language: 'eng',
  error: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_VIEW': return { ...state, view: action.payload };
    case 'UPDATE_PROFILE': return { ...state, userProfile: { ...state.userProfile, ...action.payload } };
    case 'SET_INGREDIENTS': return { ...state, ingredients: action.payload };
    case 'ADD_BATCH_RESULT': return { ...state, batchResults: [...state.batchResults, action.payload] };
    case 'SET_ANALYSIS': return { ...state, analysis: action.payload };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'ADD_SCAN_HISTORY': return { ...state, scanHistory: [...state.scanHistory, action.payload] };
    case 'SET_MANUAL_INPUT': return { ...state, manualInput: action.payload };
    case 'TOGGLE_INGREDIENT': return { ...state, selectedIngredient: state.selectedIngredient === action.payload ? null : action.payload };
    case 'ADD_RATING': return { ...state, ratings: [...state.ratings, action.payload] };
    case 'SET_ERROR': return { ...state, error: action.payload };
    case 'CLEAR_BATCH': return { ...state, batchResults: [], ingredients: [], analysis: null };
    case 'SET_SCAN_HISTORY': return { ...state, scanHistory: action.payload };
    case 'SET_LANGUAGE': return { ...state, language: action.payload };
    default: return state;
  }
}

// Substance database
const substanceDatabase = {
  'e102': { substance_id: 'e102', name: 'Tartrazine', aliases: ['E102', 'FD&C Yellow No. 5'], e_number: 'E102', ADI: '7.5 mg/kg', regulatory_status: { india: 'Permitted', usa: 'Permitted', eu: 'Restricted' }, immediate_effects: { '0-2_hours': ['Skin rashes', 'Hives'] }, long_term_effects: { '1-5_years': ['ADHD development'] }, mechanism_of_harm: 'Histamine release', organs_affected: ['Brain', 'Skin'], cellular_damage: 'Neuronal inflammation', vulnerable_populations: ['Children under 12', 'Asthmatics'], dangerous_combinations: [], commonly_found_in: ['Candies', 'Soft drinks'], detection_names: ['tartrazine', 'e102', 'fd&c yellow no. 5'], severity_score: 85, citations: ['J. Allergy Clin. Immunol., 2020'], upcoming_bans: { region: 'USA', date: '2028-01-01', description: 'Ban in some states' } },
  'e110': { substance_id: 'e110', name: 'Sunset Yellow', aliases: ['E110', 'FD&C Yellow No. 6'], e_number: 'E110', ADI: '4 mg/kg', regulatory_status: { india: 'Permitted', usa: 'Permitted', eu: 'Permitted' }, immediate_effects: { '0-2_hours': ['Skin irritation']}, long_term_effects: { '1-5_years': ['Possible tumor growth'] }, mechanism_of_harm: 'Oxidative stress', organs_affected: ['Brain', 'Skin'], cellular_damage: 'DNA oxidation', vulnerable_populations: ['Children', 'Asthmatics'], dangerous_combinations: [], commonly_found_in: ['Orange sodas', 'Desserts'], detection_names: ['sunset yellow', 'e110', 'fd&c yellow no. 6'], severity_score: 80, citations: ['Food Chem. Toxicol., 2019'] },
  'e129': { substance_id: 'e129', name: 'Allura Red', aliases: ['E129', 'FD&C Red 40'], e_number: 'E129', ADI: '7 mg/kg', regulatory_status: { india: 'Permitted', usa: 'Permitted', eu: 'Restricted' }, immediate_effects: { '0-2_hours': ['Skin flushing'] }, long_term_effects: { '1-5_years': ['Potential carcinogenic effects'] }, mechanism_of_harm: 'Dopamine disruption', organs_affected: ['Brain', 'Immune system'], cellular_damage: 'Chromosomal aberrations', vulnerable_populations: ['Children', 'Pregnant women'], dangerous_combinations: [], commonly_found_in: ['Red candies', 'Sports drinks'], detection_names: ['allura red', 'e129', 'fd&c red 40'], severity_score: 82, citations: ['Toxicol. Sci., 2021'], upcoming_bans: { region: 'USA', date: '2028-01-01', description: 'Ban in some states' } },
  'e621': { substance_id: 'e621', name: 'Monosodium Glutamate', aliases: ['E621', 'MSG'], e_number: 'E621', ADI: 'Not established', regulatory_status: { india: 'Permitted', usa: 'GRAS', eu: 'Permitted' }, immediate_effects: { '0-2_hours': ['Headaches', 'Flushing'] }, long_term_effects: { '1-5_years': ['Obesity'] }, mechanism_of_harm: 'Excitotoxicity', organs_affected: ['Brain', 'Cardiovascular system'], cellular_damage: 'Neuronal death', vulnerable_populations: ['People with MSG sensitivity'], dangerous_combinations: [], commonly_found_in: ['Chinese food', 'Soups'], detection_names: ['monosodium glutamate', 'e621'], severity_score: 80, citations: ['Neurosci. Lett., 2018'] },
  'pfas': { substance_id: 'pfas', name: 'PFAS Chemicals', aliases: ['Food packaging coating'], e_number: null, ADI: 'Not applicable', regulatory_status: { india: 'Permitted', usa: 'Phased out', eu: 'Permitted' }, immediate_effects: { '0-2_hours': ['Nausea'] }, long_term_effects: { '1-5_years': ['Cancer'] }, mechanism_of_harm: 'Cellular toxicity', organs_affected: ['Liver', 'Immune system'], cellular_damage: 'DNA damage', vulnerable_populations: ['All populations'], dangerous_combinations: [], commonly_found_in: ['Fast-food wrappers', 'Popcorn bags'], detection_names: ['pfas', 'food packaging coating'], severity_score: 95, citations: ['Environ. Sci. Technol., 2024'] },
  'trans_fats': { substance_id: 'trans_fats', name: 'Trans Fats', aliases: ['Partially hydrogenated oils'], e_number: null, ADI: 'Less than 2g/day', regulatory_status: { india: 'Banned', usa: 'Banned', eu: 'Banned' }, immediate_effects: { '0-2_hours': ['Increased appetite'] }, long_term_effects: { '1-5_years': ['Heart disease'] }, mechanism_of_harm: 'Atherosclerosis', organs_affected: ['Heart', 'Blood vessels'], cellular_damage: 'Lipid peroxidation', vulnerable_populations: ['People with heart disease'], dangerous_combinations: [], commonly_found_in: ['Fried foods', 'Baked goods'], detection_names: ['trans fats', 'partially hydrogenated oils'], severity_score: 90, citations: ['Am. J. Clin. Nutr., 2019'] },
  'e951': { substance_id: 'e951', name: 'Aspartame', aliases: ['E951', 'Equal'], e_number: 'E951', ADI: '40 mg/kg', regulatory_status: { india: 'Permitted', usa: 'Permitted', eu: 'Permitted' }, immediate_effects: { '0-2_hours': ['Headaches'] }, long_term_effects: { '1-5_years': ['Brain tumors'] }, mechanism_of_harm: 'Excitotoxicity', organs_affected: ['Brain', 'Nervous system'], cellular_damage: 'Neuronal death', vulnerable_populations: ['Phenylketonurics', 'Pregnant women'], dangerous_combinations: [], commonly_found_in: ['Diet sodas', 'Sugar-free gum'], detection_names: ['aspartame', 'e951', 'equal'], severity_score: 88, citations: ['Neurol. Sci., 2021'] },
  'e171': { substance_id: 'e171', name: 'Titanium Dioxide', aliases: ['E171', 'TiO₂'], e_number: 'E171', ADI: 'Not permitted in EU', regulatory_status: { india: 'Permitted', usa: 'Permitted', eu: 'Banned' }, immediate_effects: { '0-2_hours': ['Nausea'] }, long_term_effects: { '1-5_years': ['DNA damage'] }, mechanism_of_harm: 'Genotoxicity', organs_affected: ['Digestive system'], cellular_damage: 'DNA damage', vulnerable_populations: ['All populations'], dangerous_combinations: [], commonly_found_in: ['Candies', 'Dairy'], detection_names: ['titanium dioxide', 'e171', 'tio2'], severity_score: 65, citations: ['EFSA J., 2021'] },
  'e433': { substance_id: 'e433', name: 'Polysorbate 80', aliases: ['E433', 'Tween 80'], e_number: 'E433', ADI: '25 mg/kg', regulatory_status: { india: 'Permitted', usa: 'Permitted', eu: 'Permitted' }, immediate_effects: { '0-2_hours': ['Nausea'] }, long_term_effects: { '1-5_years': ['Digestive issues'] }, mechanism_of_harm: 'Inflammation', cellular_damage: 'Inflammatory cascade', vulnerable_populations: ['People with gut issues'], dangerous_combinations: [], commonly_found_in: ['Ice cream', 'Sauces'], detection_names: ['polysorbate 80', 'e433', 'tween 80'], severity_score: 70, citations: ['Nature, 2015'] },
  'e443': { substance_id: 'e443', name: 'Brominated Vegetable Oil', aliases: ['E443', 'BVO'], e_number: 'E443', ADI: 'Not permitted', regulatory_status: { india: 'Banned', usa: 'Banned', eu: 'Banned' }, immediate_effects: { '0-2_hours': ['Nausea'] }, long_term_effects: { '1-5_years': ['Organ damage'] }, mechanism_of_harm: 'Bromine toxicity', organs_affected: ['Liver', 'Brain'], cellular_damage: 'Oxidative stress', vulnerable_populations: ['All populations'], dangerous_combinations: [], commonly_found_in: ['Sodas', 'Sports drinks'], detection_names: ['brominated vegetable oil', 'e443', 'bvo'], severity_score: 95, citations: ['FDA Review, 2024'] },
  'e122': { substance_id: 'e122', name: 'Carmoisine', aliases: ['E122', 'Azorubine'], e_number: 'E122', ADI: '4 mg/kg', regulatory_status: { india: 'Permitted', usa: 'Banned', eu: 'Permitted' }, immediate_effects: { '0-2_hours': ['Hives'] }, long_term_effects: { '1-5_years': ['Allergic sensitization'] }, mechanism_of_harm: 'Immune activation', organs_affected: ['Skin', 'Immune system'], cellular_damage: 'Mast cell degranulation', vulnerable_populations: ['Children', 'Asthmatics'], dangerous_combinations: [], commonly_found_in: ['Jellies', 'Sweets'], detection_names: ['carmoisine', 'e122', 'azorubine'], severity_score: 80, citations: ['Eur. J. Clin. Nutr., 2018'] },
  'e954': { substance_id: 'e954', name: 'Saccharin', aliases: ['E954', "Sweet'N Low"], e_number: 'E954', ADI: '5 mg/kg', regulatory_status: { india: 'Permitted', usa: 'Permitted', eu: 'Permitted' }, immediate_effects: { '0-2_hours': ['Metallic taste'] }, long_term_effects: { '1-5_years': ['Bladder cancer'] }, mechanism_of_harm: 'Cellular toxicity', organs_affected: ['Bladder', 'Kidneys'], cellular_damage: 'DNA mutations', vulnerable_populations: ['People with diabetes'], dangerous_combinations: [], commonly_found_in: ['Table sweeteners', 'Baked goods'], detection_names: ['saccharin', 'e954', "sweet'n low"], severity_score: 85, citations: ['Cancer Lett., 2019'] },
  'sugar': { substance_id: 'sugar', name: 'Sugar (all forms)', aliases: ['Sucrose', 'High fructose corn syrup'], e_number: null, ADI: 'Less than 25g/day', regulatory_status: { india: 'Permitted', usa: 'Permitted', eu: 'Permitted' }, immediate_effects: { '0-2_hours': ['Blood sugar spike'] }, long_term_effects: { '1-5_years': ['Diabetes'] }, mechanism_of_harm: 'Glycation', organs_affected: ['Pancreas', 'Liver'], cellular_damage: 'Oxidative stress', vulnerable_populations: ['Diabetics'], dangerous_combinations: [], commonly_found_in: ['Sodas', 'Candies'], detection_names: ['sugar', 'sucrose', 'high fructose corn syrup'], severity_score: 85, citations: ['WHO Report, 2015'] },
  'salt': { substance_id: 'salt', name: 'Salt (Sodium)', aliases: ['Sodium chloride'], e_number: null, ADI: 'Less than 5g/day', regulatory_status: { india: 'Permitted', usa: 'Permitted', eu: 'Permitted' }, immediate_effects: { '0-2_hours': ['Thirst'] }, long_term_effects: { '1-5_years': ['Heart disease'] }, mechanism_of_harm: 'Fluid retention', organs_affected: ['Heart', 'Kidneys'], cellular_damage: 'Endothelial dysfunction', vulnerable_populations: ['People with hypertension'], dangerous_combinations: [], commonly_found_in: ['Processed foods', 'Snacks'], detection_names: ['salt', 'sodium', 'sodium chloride'], severity_score: 60, citations: ['Lancet, 2018'] }
};

const genericTerms = {
  'permitted synthetic food colours': ['e102', 'e110', 'e129', 'e122'],
  'artificial sweeteners': ['e951', 'e954'],
  'flavour enhancer': ['e621']
};

const barcodeDatabase = {
  '012345678905': { product: 'Sample Soda', ingredients: ['sugar', 'e102', 'water', 'e621'], batch_code: '2024-10-01' },
  '987654321098': { product: 'Healthy Snack Bar', ingredients: ['oats', 'honey', 'nuts'], batch_code: '2025-01-01' }
};

const alternativeProducts = {
  'Sample Soda': [{ product: 'Natural Juice', ingredients: ['water', 'fruit juice'], score: 95 }],
  'Healthy Snack Bar': [{ product: 'Organic Granola', ingredients: ['oats', 'maple syrup'], score: 98 }]
};

// Format ADI
const formatADI = (adi) => {
  if (!adi) return 'Not specified';
  if (adi.includes('Not') || adi.includes('Less than')) return adi;
  return adi + ' body weight';
};

// Mock OCR
const performOCR = async (image, dispatch) => {
  try {
    const { data: { text } } = await Tesseract.recognize(image, 'eng', {
      logger: () => {},
      workerPath: 'https://unpkg.com/tesseract.js@v5.1.1/dist/worker.min.js',
      corePath: 'https://unpkg.com/tesseract.js-core@v5.1.0/tesseract-core.wasm.js'
    });
    return text;
  } catch (err) {
    console.error('OCR Error:', err);
    dispatch({ type: 'SET_ERROR', payload: 'Failed to process image. Using fallback data.' });
    return 'sugar,e102,water,e621';
  }
};

// Parse ingredients
const parseIngredients = (text) => {
  if (!text) return [];
  const cleanText = text
    .replace(/ingredients?:?\s*/i, '')
    .replace(/(\band\b|\n|\t|\s{2,})/g, ',')
    .trim()
    .replace(/[<>]/g, '');
  return cleanText
    .split(/[,;]/)
    .map(ingredient => ingredient.trim().toLowerCase())
    .filter(ingredient => ingredient.length > 0)
    .filter(ingredient => !ingredient.match(/brand|company|inc|ltd/i));
};

// Find substance
const findSubstance = (ingredient) => {
  const normalized = ingredient.toLowerCase();
  if (substanceDatabase[normalized]) return substanceDatabase[normalized];
  for (const key in substanceDatabase) {
    if (substanceDatabase[key].detection_names.some(name => normalized.includes(name) || name.includes(normalized))) {
      return substanceDatabase[key];
    }
  }
  for (const generic in genericTerms) {
    if (normalized.includes(generic)) {
      return genericTerms[generic].map(id => substanceDatabase[id] || { substance_id: 'unknown', name: normalized, severity_score: 50, regulatory_status: { india: 'Unknown', usa: 'Unknown', eu: 'Unknown' }, citations: [] });
    }
  }
  return {
    substance_id: 'unknown',
    name: ingredient,
    severity_score: 50,
    regulatory_status: { india: 'Unknown', usa: 'Unknown', eu: 'Unknown' },
    citations: []
  };
};

// Calculate scores
const calculateFoodScore = (ingredients, userProfile, scanHistory) => {
  if (!Array.isArray(ingredients)) return {
    cleanScore: 100,
    packagingScore: 100,
    regulatoryScore: 100,
    temporalScore: 100,
    overallScore: 100,
    breakdown: { safe: 100, caution: 0, risk: 0 },
    warnings: [],
    trend: 'Stable'
  };

  let cleanScore = 100, packagingScore = 100, regulatoryScore = 100, temporalScore = 100;
  const warnings = [];
  let safeCount = 0, cautionCount = 0, riskCount = 0;

  const isVulnerable = (substance) => {
    return substance.vulnerable_populations.some(pop => {
      if (pop.includes('Children') && userProfile.age < 18) return true;
      if (pop.includes('Pregnant') && userProfile.pregnancyStatus === 'pregnant') return true;
      if (pop.includes('Diabetics') && userProfile.dietaryPreferences.includes('diabetic')) return true;
      if (pop.includes('Hypertension') && userProfile.dietaryPreferences.includes('low_sodium')) return true;
      return false;
    });
  };

  const checkRegulatory = (substance) => {
    let score = 100;
    if (substance.regulatory_status.india === 'Banned' || substance.regulatory_status.usa === 'Banned' || substance.regulatory_status.eu === 'Banned') score -= 30;
    if (substance.regulatory_status.india === 'Restricted' || substance.regulatory_status.usa === 'Restricted' || substance.regulatory_status.eu === 'Restricted') score -= 15;
    return Math.max(0, score);
  };

  const checkTemporal = (substance) => {
    let score = 100;
    if (substance.upcoming_bans) {
      const daysUntilBan = (new Date(substance.upcoming_bans.date) - new Date()) / (1000 * 60 * 60 * 24);
      if (daysUntilBan < 365) score -= 20;
      else if (daysUntilBan < 730) score -= 10;
    }
    return Math.max(0, score);
  };

  ingredients.forEach(ingredient => {
    const substances = findSubstance(ingredient);
    const substanceArray = Array.isArray(substances) ? substances : [substances];
    substanceArray.forEach(substance => {
      let scoreAdjustment = substance.severity_score;
      if (isVulnerable(substance)) {
        scoreAdjustment *= 1.2;
        warnings.push(`Warning: ${substance.name} may be harmful for ${substance.vulnerable_populations.join(', ')}`);
      }
      cleanScore -= scoreAdjustment / ingredients.length;
      if (substance.substance_id === 'pfas') packagingScore -= scoreAdjustment / ingredients.length;
      regulatoryScore -= (100 - checkRegulatory(substance)) / ingredients.length;
      temporalScore -= (100 - checkTemporal(substance)) / ingredients.length;
      if (substance.severity_score < 60) safeCount++;
      else if (substance.severity_score < 80) cautionCount++;
      else riskCount++;
    });
  });

  const total = safeCount + cautionCount + riskCount || 1;
  const breakdown = {
    safe: Math.round((safeCount / total) * 100),
    caution: Math.round((cautionCount / total) * 100),
    risk: Math.round((riskCount / total) * 100)
  };
  const overallScore = Math.round((cleanScore * 0.4) + (packagingScore * 0.2) + (regulatoryScore * 0.2) + (temporalScore * 0.2));
  const trend = scanHistory.length > 2 ?
    overallScore > scanHistory.slice(-3).reduce((sum, s) => sum + s.overallScore, 0) / 3 ? 'Improving' : 'Declining' : 'Stable';

  return {
    cleanScore: Math.max(0, Math.round(cleanScore)),
    packagingScore: Math.max(0, Math.round(packagingScore)),
    regulatoryScore: Math.max(0, Math.round(regulatoryScore)),
    temporalScore: Math.max(0, Math.round(temporalScore)),
    overallScore: overallScore,
    breakdown: breakdown,
    warnings: warnings,
    trend: trend
  };
};

// Check scan quality
const assessScanQuality = async (image) => {
  const img = new Image();
  return new Promise(resolve => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
      let brightness = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        brightness += (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
      }
      brightness /= (imageData.length / 4);
      resolve(brightness > 50 && brightness < 200);
    };
    img.onerror = () => resolve(false);
    img.src = URL.createObjectURL(image);
  });
};

// Camera Icon
const CameraIcon = React.memo(() => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
));

// App Component
const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const fileInputRef = useRef(null);
  const barcodeRef = useRef(null);
  const cameraRef = useRef(null);
  const captureInterval = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      document.querySelectorAll('.card').forEach(card => card.classList.add('visible'));
    }, 100);
    try {
      const cachedScans = localStorage.getItem('scanHistory');
      if (cachedScans) {
        dispatch({ type: 'SET_SCAN_HISTORY', payload: JSON.parse(cachedScans) });
      }
    } catch (err) {
      console.error('LocalStorage Parse Error:', err);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load scan history.' });
    }
    return () => {
      if (window.Quagga) Quagga.stop();
      if (cameraRef.current && cameraRef.current.srcObject) {
        cameraRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (captureInterval.current) clearInterval(captureInterval.current);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('scanHistory', JSON.stringify(state.scanHistory));
    } catch (err) {
      console.error('LocalStorage Save Error:', err);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save scan history.' });
    }
  }, [state.scanHistory]);

  const handleProfileChange = useCallback((e) => {
    const { name, value } = e.target;
    dispatch({
      type: 'UPDATE_PROFILE',
      payload: {
        [name]: name === 'dietaryPreferences' ? value.split(',').map(v => v.trim()).filter(v => v) : value
      }
    });
  }, []);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      dispatch({ type: 'SET_ERROR', payload: 'Invalid file. Use JPEG/PNG under 5MB.' });
      return;
    }
    const isGood = await assessScanQuality(file);
    if (!isGood) {
      dispatch({ type: 'SET_ERROR', payload: 'Poor scan quality. Please retry with better lighting.' });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const text = await performOCR(file, dispatch);
      const ingredients = parseIngredients(text);
      const analysis = calculateFoodScore(ingredients, state.userProfile, state.scanHistory);
      const result = { product: 'Scanned Product', ingredients, analysis, batch_code: '2025-01-01' };
      dispatch({ type: 'SET_INGREDIENTS', payload: ingredients });
      dispatch({ type: 'ADD_BATCH_RESULT', payload: result });
      dispatch({ type: 'SET_ANALYSIS', payload: analysis });
      dispatch({ type: 'ADD_SCAN_HISTORY', payload: { date: new Date().toISOString(), overallScore: analysis.overallScore } });
      dispatch({ type: 'SET_VIEW', payload: 'results' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to process image.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.userProfile, state.scanHistory]);

  const startBarcodeScanner = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'barcode' });
    dispatch({ type: 'SET_LOADING', payload: true });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      dispatch({ type: 'SET_ERROR', payload: 'Camera not supported. Try manual input.' });
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_VIEW', payload: 'home' });
      return;
    }
    try {
      Quagga.init({
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: barcodeRef.current,
          constraints: { facingMode: 'environment' }
        },
        decoder: { readers: ['upc_reader', 'ean_reader'] }
      }, (err) => {
        if (err) {
          dispatch({ type: 'SET_ERROR', payload: `Error starting scanner: ${err.message}` });
          dispatch({ type: 'SET_LOADING', payload: false });
          dispatch({ type: 'SET_VIEW', payload: 'home' });
          return;
        }
        Quagga.start();
      });
      Quagga.onDetected((data) => {
        Quagga.stop();
        const code = data.codeResult.code;
        const product = barcodeDatabase[code] || { product: 'Unknown', ingredients: [], batch_code: 'Unknown' };
        const ingredients = parseIngredients(product.ingredients.join(','));
        const analysis = calculateFoodScore(ingredients, state.userProfile, state.scanHistory);
        const result = { product: product.product, ingredients, analysis, batch_code: product.batch_code };
        dispatch({ type: 'SET_INGREDIENTS', payload: ingredients });
        dispatch({ type: 'ADD_BATCH_RESULT', payload: result });
        dispatch({ type: 'SET_ANALYSIS', payload: analysis });
        dispatch({ type: 'ADD_SCAN_HISTORY', payload: { date: new Date().toISOString(), overallScore: analysis.overallScore } });
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'SET_VIEW', payload: 'results' });
      });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: `Error initializing barcode scanner: ${err.message}` });
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_VIEW', payload: 'home' });
    }
  }, [state.userProfile, state.scanHistory]);

  const startLiveCamera = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'camera' });
    dispatch({ type: 'SET_LOADING', payload: true });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      dispatch({ type: 'SET_ERROR', payload: 'Camera not supported. Try manual input.' });
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_VIEW', payload: 'home' });
      return;
    }
    const video = cameraRef.current;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        video.srcObject = stream;
        video.play().catch(err => {
          dispatch({ type: 'SET_ERROR', payload: `Error playing video: ${err.message}` });
          dispatch({ type: 'SET_LOADING', payload: false });
          dispatch({ type: 'SET_VIEW', payload: 'home' });
        });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        captureInterval.current = setInterval(() => {
          if (state.view !== 'camera') return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          performOCR({ img: canvas, 'eng'- 'wtesseract': { state: state.worker } })
            .then(text => {
              const ingredients = parseIngredients(text);
              if (ingredients.length > 0) {
                video.srcObject.getTracks().forEach(track => track.stop());
                clearInterval(captureInterval.current);
                const analysis = calculateFoodScore(ingredients, state.userProfile, state.scanHistory);
                const result = { product: 'Live Scanned Product', ingredients, analysis, batch_code: '2025-06-30' };
                dispatch({ type: 'SET_INGREDIENTS', payload: ingredients });
                dispatch({ type: 'ADD_BATCH_RESULT', payload: result });
                dispatch({ type: 'SET_ANALYSIS', payload: analysis });
                dispatch({ type: 'ADD_SCAN_HISTORY', payload: { date: new Date().toISOString(), overallScore: analysis.overallScore } });
                dispatch({ type: 'SET_VIEW', payload: 'results' });
              }
            })
            .catch(err => {
              dispatch({ type: 'SET_ERROR', payload: `Failed to process camera frame: ${err.message}` });
            })
            .finally(() => {
              dispatch({ type: 'SET_LOADING', payload: false });
            });
        }, 2000);
      })
      .catch(err => {
        console.error('Camera Access Error:', err);
        dispatch({ type: 'SET_ERROR', payload: `Error accessing camera: ${err.message}` });
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'SET_VIEW', payload: 'home' });
      });
  }, [state.userProfile, state.scanHistory, state.view]);

  const stopCamera = useCallback(() => {
    if (cameraRef.current && cameraRef.current.srcObject) {
      cameraRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    if (captureInterval.current) clearInterval(captureInterval.current);
    dispatch({ type: 'SET_VIEW', payload: 'home' });
    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  const handleManualInput = useCallback(() => {
    if (!state.manualInput.trim()) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter ingredients.' });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const ingredients = parseIngredients(state.manualInput);
      const analysis = calculateFoodScore(ingredients, state.userProfile, state.scanHistory);
      const result = { product: 'Manually Entered Product', ingredients, analysis, batch_code: 'Unknown' };
      dispatch({ type: 'SET_INGREDIENTS', payload: ingredients });
      dispatch({ type: 'ADD_BATCH_RESULT', payload: result });
      dispatch({ type: 'SET_ANALYSIS', payload: analysis });
      dispatch({ type: 'ADD_SCAN_HISTORY', payload: { date: new Date().toISOString(), overallScore: analysis.overallScore } });
      dispatch({ type: 'SET_VIEW', payload: 'results' });
      dispatch({ type: 'SET_MANUAL_INPUT', payload: '' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Error processing manual input: ${err.message}' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.manualInput, state.userProfile, state.scanHistory]);

  const toggleIngredientDetail = useCallback((ingredient) => {
    dispatch({ type: 'TOGGLE_INGREDIENT', payload: ingredient });
  }, []);

  const addRating = useCallback((score) => {
    dispatch({ type: 'ADD_RATING', payload: { score, date: new Date().toISOString() } });
  }, []);

  const clearBatch = useCallback(() => {
    dispatch({ type: 'CLEAR_BATCH' });
  }, []);

  const getBadge = (score) => {
    if (score >= 80) return '🥇 Excellent';
    if (score >= 60) return '💡 Good';
    if (score >= 40) return '⚠️ Fair';
    return '❌ Poor';
  };

  return (
    <ErrorBoundary>
      <div className="container mx-auto w-full p-3 sm:p-6">
        <h1 class="text-xl sm:text-4xl font-bold text-center mb-4 sm:mb-6">Eat True - Biometric Nutrition Scanner</h1>
        {state.error && (
          <div className="p-3 bg-red-500 text-white rounded-md mb-4 sm:mb-6 flex justify-between items-center">
            <span>{state.error}</span>
            <button
              className="p-1 text-white hover:text-gray-200"
              onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
        {state.loading && (
          <div className="p-3 bg-blue-500 text-white rounded-md mb-4 sm:mb-6 text-center">
            Loading...
          </div>
        )}

        {state.view === 'home' && (
          <div className="card bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-lg shadow-sm mb-4 sm:mb-6">
            <button
              class="w-full p-3 sm:p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[48px] min-h-[48px]"
              onClick={() => fileInputRef.current.click()}
              aria-label="Upload image to scan"
            >
              <CameraIcon />
              <span className="ml-2">Scan Image</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/jpeg,image/png"
              class="hidden"
            />
            <button
              class="w-full p-3 sm:p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[48px] min-h-[48px] mt-2 sm:mt-4"
              onClick={startBarcodeScanner}
              aria-label="Start barcode scanner"
            >
              <CameraIcon />
              <span class="ml-2">Scan Barcode</span>
            </button>
            <button
              class="w-full p-3 sm:p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[48px] min-h-[48px] mt-2 sm:mt-4"
              onClick={startLiveCamera}
              aria-label="Start live camera scanning"
            >
              <CameraIcon />
              <span class="ml-2">Live Camera</span>
            </button>
            <div class="mt-4">
              <label class="text-sm font-medium" for="manualInput">Manual Input</label>
              <input
                id="manualInput"
                type="text"
                value={state.manualInput}
                onChange={e => dispatch({ type: 'SET_MANUAL_INPUT', payload: e.target.value })}
                class="w-full p-3 border border-gray-300 rounded-md mt-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Enter ingredients (comma-separated)"
                aria-label="Enter ingredients manually"
              />
              <button
                class="w-full p-3 sm:p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center min-w-[48px] min-h-[48px] mt-2 sm:mt-4"
                onClick={handleManualInput}
                aria-label="Analyze manual input"
              >
                Analyze
              </button>
            </div>
            <div class="mt-4">
              <label class="text-sm font-medium" for="languageSelect">Language</label>
              <select
                id="languageSelect"
                value={state.language}
                onChange={e => dispatch({ type: 'SET_LANGUAGE', payload: e.target.value })}
                class="w-full p-3 border border-gray-300 rounded-md mt-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                aria-label="Select language"
              >
                <option value="eng">English</option>
                <option value="spa">Spanish</option>
                <option value="fra">French</option>
              </select>
            </div>
            {state.scanHistory.length > 0 && (
              <div class="mt-4">
                <h3 class="text-lg font-semibold mb-2">Recent Scans</h3>
                <ul class="list-disc pl-5">
                  {state.scanHistory.slice(-3).map((scan, index) => (
                    <li key={index} class="text-gray-600 dark:text-gray-400">
                      {new Date().toLocaleDateString()}: Score {scan.overallScore}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              class="w-full p-3 sm:p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center min-w-[48px] min-h-[48px] mt-2 sm:mt-4"
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'profile' })}
              aria-label="Edit profile"
            >
              Edit Profile
            </button>
          </div>
        )}

        {state.view === 'profile' && (
          <div class="card bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-lg shadow-sm mb-4 sm:mb-6">
            <h2 class="text-lg font-semibold mb-4">User Profile</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium" for="ageInput">Age</label>
                <input
                  id="ageInput"
                  type="number"
                  name="age"
                  value={state.userProfile.age}
                  onChange={handleProfileChange}
                  class="w-full p-3 border border-gray-300 rounded-md mt-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  aria-label="Enter age"
                />
              </div>
              <div>
                <label class="text-sm font-medium" for="dietaryInput">Dietary Preferences</label>
                <input
                  id="dietaryInput"
                  type="text"
                  name="dietaryPreferences"
                  value={state.userProfile.dietaryPreferences.join(',')}
                  onChange={handleProfileChange}
                  class="w-full p-3 border border-gray-300 rounded-md mt-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  placeholder="e.g., diabetic, low_sodium"
                  aria-label="Enter dietary preferences"
                />
              </div>
              <div>
                <div>
                <label class="text-sm font-medium" for="pregnancySelect">Pregnancy Status</label>
                <select
                  id="pregnancySelect"
                  name="pregnancyStatus"
                  value={state.userProfile.pregnancyStatus}
                  onchange={handleProfileChange}
                  class="w-full p-3 border border-gray-300 rounded-md mt-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  aria-label="Select pregnancy status"
                >
                <option value="not_pregnant">Not Pregnant</option>
                <option value="pregnant">Pregnant</option>
                </select>
              </div>
            </div>
            <button
              class="w-full p-3 sm:p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[48px] min-h-[48px] mt-4"
              onClick={() { => dispatch({ type: 'SET_VIEW', payload: 'home' })}}
              aria-label="Back to home"
            >
              Back to Home
            </span>
            </button>
          </div>
        )}}

        {state.view === 'barcode' && (
          <div class="card bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-lg shadow-sm mb-6">
            <h2 class="text-lg font-semibold mb-4">Barcode Scanner</h2>
            <div ref={barcodeRef} class="w-full max-w-md mx-auto" />
            <button 
              class="w-full p-3 sm:p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center min-w-[48px] min-h-[48px] mt-4"
              onClick={() => {
                Quagga.stop();
                dispatch({ type: 'SET_VIEW', payload: 'home' });
                dispatch({ type: 'SET_LOOADING', payload: false });
              }}
              aria-label="Stop barcode scanner"
            >
              Stop Scanner
            </button>
          </div>
        )}}

        {state.view === 'camera' && (
          <div class="card bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-lg shadow-sm mb-6">
            <h2 class="text-lg font-semibold mb-4">Live Camera Scan</h2>
            <video ref={cameraRef} class="w-full max-w-md mx-auto" autoPlay playsInline />
            <button 
              class="w-full p-3 sm:p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center min-w-[48px] min-h-[48px] mt-4"
              onClick={stopCamera}
              aria-label="Stop camera"
            >
              Stop Camera
            </button>
          </div>
        ))}
      </div>
    </ErrorBoundary>
  );
};

export default App;