// ============================================================
//  INVITATIONS — SITE CONFIGURATION
//  Edit this file to update products, prices, copy and colours.
//  Changes here reflect across the whole site automatically.
// ============================================================

const SITE_CONFIG = {

  // ── BRAND ──────────────────────────────────────────────
  brand: {
    name:    'Invitations',
    tagline: 'Luxury Wedding Stationery',
    email:   'hello@invitations.co.uk',
    phone:   '',
    address: 'United Kingdom',
  },

  // ── COLOURS ────────────────────────────────────────────
  // These feed the CSS variables used across every page.
  colours: {
    cream:      '#FAF7F2',
    blush:      '#F0DDD8',
    lavender:   '#DDD5E8',
    sage:       '#D1DDD0',
    mist:       '#E8EBF0',
    gold:       '#B8976A',
    goldLight:  '#D4B896',
    brown:      '#6B4F3A',
    text:       '#3D2E24',
    textSoft:   '#7A6558',
    textPale:   '#B0A098',
    white:      '#FFFFFF',
    border:     '#E8DDD8',
  },

  // ── HOMEPAGE COPY ───────────────────────────────────────
  hero: {
    eyebrow:  'Luxury Wedding Stationery',
    heading:  'Where Every Detail Tells Your Story',
    subtext:  'Handcrafted invitation suites for the modern romantic. Printed on the finest papers, delivered with care.',
    cta1:     'Explore Collections',
    cta2:     'Design Your Own',
  },

  // ── PRODUCTS ───────────────────────────────────────────
  // To add a product: copy one block, change the id and details.
  // To remove: delete the block.
  // Prices are in GBP including 20% VAT, per 50 invitations.
  products: [
    {
      id:          'margaux',
      name:        'The Margaux Suite',
      style:       'Classic · Foil Detail',
      price:       185,
      description: 'Timeless elegance on 400gsm cotton-rag with gold foil lettering and a blush envelope liner. A perennial favourite.',
      icon:        '✦',
      background:  '#F5EDE6',
      textColour:  '#3D2E24',
      featured:    true,
    },
    {
      id:          'orchard',
      name:        'The Orchard Suite',
      style:       'Botanical · Watercolour',
      price:       215,
      description: 'Delicate botanical watercolour illustrations framing your details. Printed on textured 350gsm ivory stock.',
      icon:        '🌿',
      background:  '#E8EFF0',
      textColour:  '#2A3D35',
      featured:    true,
    },
    {
      id:          'arch',
      name:        'The Arch Suite',
      style:       'Modern · Letterpress',
      price:       235,
      description: 'Bold arched typography with deep letterpress impression. A striking, contemporary choice.',
      icon:        '◯',
      background:  '#E8E4EE',
      textColour:  '#2E2A3D',
      featured:    true,
    },
    {
      id:          'eden',
      name:        'The Eden Suite',
      style:       'Romantic · Pressed Foil',
      price:       195,
      description: 'Soft peonies and eucalyptus entwined with rose gold foil. Romance in every detail.',
      icon:        '🌸',
      background:  '#F0DDD8',
      textColour:  '#3D2E24',
      featured:    false,
    },
    {
      id:          'grove',
      name:        'The Grove Suite',
      style:       'Minimalist · Engraved',
      price:       175,
      description: 'Clean geometric lines and deep engraving on smooth white 300gsm. Less is more.',
      icon:        '□',
      background:  '#EAEAEA',
      textColour:  '#2A2A2A',
      featured:    false,
    },
    {
      id:          'soleil',
      name:        'The Soleil Suite',
      style:       'Art Deco · Gold',
      price:       250,
      description: 'Sunburst motifs and art deco flourishes with 24ct gold foil on black card.',
      icon:        '☀',
      background:  '#1C1C1C',
      textColour:  '#D4B896',
      featured:    false,
    },
  ],

  // ── PAPER STOCKS ───────────────────────────────────────
  papers: [
    { id: 'smooth', name: 'Smooth White',   subtitle: '300gsm · Crisp & classic',  priceExtra: 0  },
    { id: 'cotton', name: 'Cotton Rag',     subtitle: '400gsm · Luxury feel',      priceExtra: 20 },
    { id: 'vellum', name: 'Vellum Overlay', subtitle: 'Translucent · Ethereal',    priceExtra: 35 },
  ],

  // ── BASE PRICING ───────────────────────────────────────
  pricing: {
    basePerFifty:  150,   // £ excl. VAT per 50 invitations (before paper upgrade)
    vatRate:       0.20,  // 20% UK VAT
    minQty:        25,
    qtyStep:       25,
  },

  // ── DELIVERY ───────────────────────────────────────────
  delivery: [
    { id: 'standard', name: 'Standard',  subtitle: '5–7 working days', price: 0,    note: 'Free on all orders' },
    { id: 'express',  name: 'Express',   subtitle: '2–3 working days', price: 12,   note: 'inc. VAT' },
    { id: 'next',     name: 'Next Day',  subtitle: 'Order before 12pm', price: 18,  note: 'inc. VAT' },
  ],

  // ── PROCESS STEPS ──────────────────────────────────────
  process: [
    { num: '01', title: 'Browse & Select',  desc: 'Explore our curated collections and choose the suite that captures your vision.' },
    { num: '02', title: 'Personalise',      desc: 'Share your names, date, venue and wording. Choose your paper and finishing touches.' },
    { num: '03', title: 'Proof & Approve',  desc: 'Receive a digital proof within 3 business days. We refine until every detail is right.' },
    { num: '04', title: 'Print & Deliver',  desc: 'Lovingly printed, quality-checked and shipped directly to your door via DPD.' },
  ],

  // ── TESTIMONIALS ───────────────────────────────────────
  testimonials: [
    {
      quote:  'Absolutely breathtaking. Every guest commented on how beautiful our invitations were. Worth every penny.',
      author: 'Charlotte & James',
      date:   'Married June 2024',
    },
    {
      quote:  'The design studio was so intuitive. We created exactly what we had in our minds and it came out perfectly.',
      author: 'Amelia & Oliver',
      date:   'Married August 2024',
    },
    {
      quote:  'From ordering to delivery, the whole experience was luxurious. Our guests thought we had hired a designer.',
      author: 'Isabella & William',
      date:   'Married September 2024',
    },
  ],

  // ── DESIGN STUDIO TEMPLATES ────────────────────────────
  designTemplates: [
    { id: 'classic',   name: 'Classic Border',   desc: 'Double-line border with ornamental details' },
    { id: 'arch',      name: 'Arch Frame',        desc: 'Romantic arched panel with soft curves' },
    { id: 'botanical', name: 'Botanical Wreath',  desc: 'Floral corner motifs with oval surround' },
    { id: 'minimal',   name: 'Minimal Line',      desc: 'Single hairline rules, clean and refined' },
    { id: 'deco',      name: 'Art Deco',          desc: 'Geometric frame with corner flourishes' },
    { id: 'romantic',  name: 'Romantic Oval',     desc: 'Soft oval border with delicate accents' },
  ],

  // ── TEXT COLOUR SWATCHES ───────────────────────────────
  textColours: [
    { hex: '#3D2E24', name: 'Espresso'  },
    { hex: '#1C1C1C', name: 'Midnight'  },
    { hex: '#2C3E50', name: 'Navy'      },
    { hex: '#2E4A3E', name: 'Forest'    },
    { hex: '#4A3728', name: 'Chocolate' },
    { hex: '#5C4A6E', name: 'Plum'      },
    { hex: '#6B4F3A', name: 'Brown'     },
    { hex: '#7A6558', name: 'Taupe'     },
    { hex: '#8B7355', name: 'Warm Grey' },
    { hex: '#4A5568', name: 'Slate'     },
    { hex: '#C97B3A', name: 'Copper'    },
    { hex: '#B8976A', name: 'Gold'      },
  ],

  // ── BORDER COLOUR SWATCHES ────────────────────────────
  borderColours: [
    { hex: '#B8976A', name: 'Gold'      },
    { hex: '#C9A96E', name: 'Champagne' },
    { hex: '#D4B896', name: 'Warm Gold' },
    { hex: '#C0A882', name: 'Antique'   },
    { hex: '#B87333', name: 'Copper'    },
    { hex: '#A8C4B8', name: 'Sage'      },
    { hex: '#D4A5A5', name: 'Blush'     },
    { hex: '#B5A8D0', name: 'Lavender'  },
    { hex: '#8FB8AD', name: 'Mint'      },
    { hex: '#C4A882', name: 'Sand'      },
    { hex: '#1C1C1C', name: 'Black'     },
    { hex: '#7A8FA6', name: 'Steel'     },
  ],

  // ── DEMO TRACKING ORDERS ──────────────────────────────
  // Remove these when you go live
  demoOrders: {
    'INV-2025-5678': {
      email:  'charlotte@example.com',
      name:   'Charlotte Thornton',
      suite:  'The Margaux Suite',
      qty:    75,
      total:  '£277.50',
      date:   '12 Nov 2024',
      status: 'dispatched',
      dpd:    'DPD1234567890',
      stages: [
        { name: 'Order Received',  desc: 'Your order was received and confirmed.',           date: '12 Nov 2024', done: true  },
        { name: 'Design Approved', desc: 'Your digital proof was approved.',                 date: '14 Nov 2024', done: true  },
        { name: 'Printing',        desc: 'Your invitations have been printed.',              date: '16 Nov 2024', done: true  },
        { name: 'Dispatched',      desc: 'Dispatched via DPD. Tracking: DPD1234567890',     date: '19 Nov 2024', done: true, active: true },
        { name: 'Delivered',       desc: 'Estimated delivery: 20–21 Nov 2024',              date: '—',           done: false },
      ],
    },
    'INV-2025-9012': {
      email:  'amelia@example.com',
      name:   'Amelia Harrison',
      suite:  'The Eden Suite',
      qty:    50,
      total:  '£195.00',
      date:   '2 Dec 2024',
      status: 'proof',
      stages: [
        { name: 'Order Received',  desc: 'Your order was received and confirmed.',           date: '2 Dec 2024',  done: true  },
        { name: 'Design Approved', desc: 'Your digital proof has been sent to your inbox.',  date: '3 Dec 2024',  done: false, active: true },
        { name: 'Printing',        desc: 'Will begin after proof approval.',                 done: false },
        { name: 'Dispatched',      desc: 'Pending.',                                         done: false },
        { name: 'Delivered',       desc: 'Pending.',                                         done: false },
      ],
    },
  },

  // ── ADMIN ─────────────────────────────────────────────
  admin: {
    username: 'admin',
    password: 'invitations2025',  // Change before going live!
  },

  // ── STRIPE ────────────────────────────────────────────
  stripe: {
    publishableKey: 'pk_test_51TCFRRC3QRnCbN5msu0EUKnTNyFg4xKmYigz10VedpcPiGtowvuYHxNu4er5VoQ19K8tdaoN6FLriWhWHMH6E0hu00mTmj4IPN',
  },

};
