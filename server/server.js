const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const app = express()
const port = Number(process.env.PORT) || 5000
const companyNames = [
  'Wipro',
  'HCLTech',
  'Accenture',
  'TCS',
  'Infosys',
  'Cognizant',
  'Capgemini',
  'IBM',
  'Tech Mahindra',
  'Deloitte',
]
const departments = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Electrical & Electronics',
  'Mechanical Engineering',
  'Civil Engineering',
  'Business Administration',
  'Other',
]
const studyYears = ['1st year', '2nd year', '3rd year', '4th year', 'Final year']
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const registrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    studentId: { type: String, required: true, unique: true, trim: true },
    department: { type: String, required: true, enum: departments },
    year: { type: String, required: true, enum: studyYears },
    section: { type: String, required: true, trim: true },
    bloodGroup: { type: String, required: true, enum: bloodGroups },
    fatherName: { type: String, required: true, trim: true },
    motherName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    arrears: { type: Number, required: true, min: 0, max: 0 },
    companyPreferences: {
      type: [{ type: String, enum: companyNames }],
      required: true,
      validate: {
        validator: (preferences) => preferences.length === 4 && new Set(preferences).size === 4,
        message: 'Select exactly four different companies.',
      },
    },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

const Registration = mongoose.model('Registration', registrationSchema)

app.use(cors())
app.use(express.json({ limit: '20kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
})

app.get('/api/registrations', async (_request, response) => {
  const registrations = await Registration.find().sort({ submittedAt: -1 }).lean()
  response.json(registrations)
})

app.post('/api/registrations', async (request, response) => {
  const body = request.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({ message: 'Registration data must be an object.' })
  }

  const requiredFields = [
    'name',
    'studentId',
    'department',
    'year',
    'section',
    'bloodGroup',
    'fatherName',
    'motherName',
    'phone',
    'email',
  ]
  const missingField = requiredFields.find((field) => typeof body[field] !== 'string' || !body[field].trim())
  if (missingField) {
    return response.status(400).json({ message: `${missingField} is required.` })
  }
  if (body.arrears !== 0 && body.arrears !== '0') {
    return response.status(400).json({ message: 'Students must have zero standing arrears.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return response.status(400).json({ message: 'Enter a valid email address.' })
  }
  if (!/^[0-9+() -]{7,18}$/.test(body.phone.trim())) {
    return response.status(400).json({ message: 'Enter a valid phone number.' })
  }
  if (
    !Array.isArray(body.companyPreferences) ||
    body.companyPreferences.length !== 4 ||
    new Set(body.companyPreferences).size !== 4 ||
    body.companyPreferences.some((company) => !companyNames.includes(company))
  ) {
    return response.status(400).json({ message: 'Select exactly four different valid companies.' })
  }

  const registrationData = Object.fromEntries(
    requiredFields.map((field) => [field, body[field].trim()]),
  )
  registrationData.arrears = 0
  registrationData.companyPreferences = body.companyPreferences
  registrationData.submittedAt = new Date()

  const registration = await Registration.findOneAndUpdate(
    { studentId: registrationData.studentId },
    registrationData,
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )
  response.status(201).json({ registration })
})

app.use((error, _request, response, _next) => {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return response.status(400).json({ message: 'Registration contains invalid fields.' })
  }
  console.error('Request failed:', error.name || 'UnknownError')
  response.status(500).json({ message: 'An internal server error occurred.' })
})

async function startServer() {
  if (!process.env.Mongo_URI) {
    throw new Error('Mongo_URI is missing from server/.env')
  }

  await mongoose.connect(process.env.Mongo_URI)
  app.listen(port, () => {
    console.log(`Registration API listening at http://localhost:${port}`)
  })
}

startServer().catch((error) => {
  console.error(`Server startup failed: ${error.name || 'UnknownError'}`)
  process.exit(1)
})