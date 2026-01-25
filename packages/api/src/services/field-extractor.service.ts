// Field Extractor Service
// Extracts patient fields from OCR text using regex patterns

export interface ExtractedField {
  fieldName: string;
  value: string;
  confidence: number;
  matchContext: string;
}

export interface ExtractedPatientData {
  firstName?: ExtractedField;
  lastName?: ExtractedField;
  dateOfBirth?: ExtractedField;
  gender?: ExtractedField;
  phone?: ExtractedField;
  email?: ExtractedField;
  addressLine1?: ExtractedField;
  addressLine2?: ExtractedField;
  city?: ExtractedField;
  state?: ExtractedField;
  zip?: ExtractedField;
  insuranceProvider?: ExtractedField;
  insuranceId?: ExtractedField;
  emergencyContactName?: ExtractedField;
  emergencyContactPhone?: ExtractedField;
}

export interface ExtractedReferralData {
  referringPhysician?: ExtractedField;
  referringFacility?: ExtractedField;
  reasonForReferral?: ExtractedField;
  referralDate?: ExtractedField;
}

export interface ExtractedLabData {
  labName?: ExtractedField;
  testDate?: ExtractedField;
  testResults: Array<{
    testName: string;
    value: string;
    unit: string;
    referenceRange: string;
    abnormal: boolean;
  }>;
}

// Regex patterns for field extraction
const patterns = {
  // Name patterns - multiple strategies for referral letters
  fullName: /(?:patient\s*(?:name)?|name)\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-zA-Z\-']+)/i,
  firstName: /(?:first\s*name|given\s*name)\s*[:\-]?\s*([A-Z][a-zA-Z\-']+)/i,
  lastName: /(?:last\s*name|surname|family\s*name)\s*[:\-]?\s*([A-Z][a-zA-Z\-']+)/i,

  // Additional name patterns for referral letters
  rePattern: /(?:^|\n)\s*re[:\s]+(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Z][a-zA-Z\-']+)\s+([A-Z][a-zA-Z\-']+)/im,
  patientColon: /patient\s*[:\-]\s*(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Z][a-zA-Z\-']+)\s+([A-Z][a-zA-Z\-']+)/i,
  referringPattern: /(?:referring|refer)\s+(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Z][a-zA-Z\-']+)\s+([A-Z][a-zA-Z\-']+)/i,
  dearDoctorPattern: /dear\s+(?:dr\.?|doctor)\s+[a-zA-Z\-']+[,\s]+(?:i\s+am\s+)?(?:referring|writing\s+(?:to\s+)?refer)\s+(?:mr\.?|mrs\.?|ms\.?|miss)?\s*([A-Z][a-zA-Z\-']+)\s+([A-Z][a-zA-Z\-']+)/i,
  thankYouPattern: /(?:seeing|reviewing|assessing)\s+(?:mr\.?|mrs\.?|ms\.?|miss)?\s*([A-Z][a-zA-Z\-']+)\s+([A-Z][a-zA-Z\-']+)/i,
  allCapsName: /(?:^|\n)\s*([A-Z]{2,}[A-Z\-']*)\s+([A-Z]{2,}[A-Z\-']*)\s*(?:\n|$)/m,

  // Date of birth patterns
  dateOfBirth: /(?:d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date|birthdate)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,

  // Gender patterns
  gender: /(?:gender|sex)\s*[:\-]?\s*(male|female|m|f|other|non-binary)/i,

  // Phone patterns
  phone: /(?:phone|tel(?:ephone)?|mobile|cell|contact\s*(?:number|#)?)\s*[:\-]?\s*\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/i,
  phoneNumber: /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/,

  // Email pattern
  email: /(?:email|e-mail)\s*[:\-]?\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
  emailStandalone: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,

  // Address patterns
  addressLine1: /(?:address|street\s*address|mailing\s*address)\s*[:\-]?\s*(\d+\s+[\w\s]+(?:st(?:reet)?|ave(?:nue)?|rd|road|blvd|boulevard|dr(?:ive)?|ln|lane|way|ct|court|pl(?:ace)?|cir(?:cle)?))\.?/i,
  addressWithUnit: /(\d+\s+[\w\s]+(?:st(?:reet)?|ave(?:nue)?|rd|road|blvd|boulevard|dr(?:ive)?|ln|lane|way|ct|court|pl(?:ace)?|cir(?:cle)?))\.?\s*(?:#|apt\.?|suite|unit)?\s*(\w+)?/i,
  cityStateZip: /([A-Z][a-zA-Z\s]+),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/,

  // Insurance patterns
  insuranceProvider: /(?:insurance\s*(?:company|provider|carrier)|health\s*plan|payer)\s*[:\-]?\s*([A-Za-z\s&]+?)(?:\n|$|member|policy|id|group)/i,
  insuranceId: /(?:member\s*id|policy\s*(?:number|#|id)|insurance\s*id|subscriber\s*id)\s*[:\-]?\s*([A-Z0-9\-]+)/i,
  groupNumber: /(?:group\s*(?:number|#|id))\s*[:\-]?\s*([A-Z0-9\-]+)/i,

  // Emergency contact patterns
  emergencyContactName: /(?:emergency\s*contact|emergency\s*contact\s*name|in\s*case\s*of\s*emergency)\s*[:\-]?\s*([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+)+)/i,
  emergencyContactPhone: /(?:emergency\s*(?:contact\s*)?(?:phone|number|tel))\s*[:\-]?\s*\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/i,

  // Referral patterns
  referringPhysician: /(?:referring\s*(?:physician|doctor|provider)|referred\s*by|from\s*dr\.?)\s*[:\-]?\s*(?:dr\.?\s*)?([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+)+)/i,
  referringFacility: /(?:referring\s*(?:facility|hospital|clinic|practice)|from)\s*[:\-]?\s*([A-Z][a-zA-Z\s&\-]+?)(?:\n|address|phone|fax)/i,
  reasonForReferral: /(?:reason\s*for\s*referral|referral\s*reason|chief\s*complaint|reason\s*for\s*visit)\s*[:\-]?\s*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i,

  // Lab patterns
  labName: /(?:laboratory|lab\s*name|performed\s*(?:at|by))\s*[:\-]?\s*([A-Za-z\s&\-]+?)(?:\n|address|phone|result)/i,
  testDate: /(?:collection\s*date|date\s*collected|test\s*date|specimen\s*date)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  labResultLine: /([A-Za-z\s\-]+)\s+(\d+\.?\d*)\s*([a-zA-Z\/%]+)?\s*(?:\(?\s*(\d+\.?\d*\s*[-–]\s*\d+\.?\d*)\s*\)?)?/g,

  // State abbreviations
  states: /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/,
  zipCode: /\b(\d{5}(?:-\d{4})?)\b/,
};

function getMatchContext(text: string, matchIndex: number, contextLength = 50): string {
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(text.length, matchIndex + contextLength);
  let context = text.substring(start, end);
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';
  return context.replace(/\n/g, ' ').trim();
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function normalizeDate(dateStr: string): string {
  // Try to parse and normalize date to YYYY-MM-DD format
  const parts = dateStr.split(/[\/-]/);
  if (parts.length !== 3) return dateStr;

  let year: number, month: number, day: number;

  // Check if first part is a 4-digit year (YYYY-MM-DD format)
  if (parts[0].length === 4) {
    year = parseInt(parts[0]);
    month = parseInt(parts[1]);
    day = parseInt(parts[2]);
  } else {
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    year = parseInt(parts[2]);

    if (year < 100) {
      year = year > 30 ? 1900 + year : 2000 + year;
    }

    // Detect DD/MM/YYYY vs MM/DD/YYYY
    // If first number > 12, it must be day (DD/MM/YYYY)
    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      // If second number > 12, it must be day (MM/DD/YYYY)
      month = first;
      day = second;
    } else {
      // Ambiguous - assume MM/DD/YYYY (US format)
      month = first;
      day = second;
    }
  }

  // Validate
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return dateStr;
  }

  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function normalizeGender(gender: string): string {
  const lower = gender.toLowerCase().trim();
  if (lower === 'm' || lower === 'male') return 'male';
  if (lower === 'f' || lower === 'female') return 'female';
  return gender;
}

export function extractPatientData(text: string): ExtractedPatientData {
  const data: ExtractedPatientData = {};

  // Helper to capitalize name properly
  const capitalizeName = (name: string): string => {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // Try multiple name extraction strategies in order of confidence
  let nameFound = false;

  // Strategy 1: "Re: FirstName LastName" pattern (very common in referral letters)
  const reMatch = text.match(patterns.rePattern);
  if (reMatch && !nameFound) {
    data.firstName = {
      fieldName: 'firstName',
      value: capitalizeName(reMatch[1]),
      confidence: 0.95,
      matchContext: getMatchContext(text, reMatch.index || 0),
    };
    data.lastName = {
      fieldName: 'lastName',
      value: capitalizeName(reMatch[2]),
      confidence: 0.95,
      matchContext: getMatchContext(text, reMatch.index || 0),
    };
    nameFound = true;
  }

  // Strategy 2: "Patient: FirstName LastName" pattern
  const patientColonMatch = text.match(patterns.patientColon);
  if (patientColonMatch && !nameFound) {
    data.firstName = {
      fieldName: 'firstName',
      value: capitalizeName(patientColonMatch[1]),
      confidence: 0.95,
      matchContext: getMatchContext(text, patientColonMatch.index || 0),
    };
    data.lastName = {
      fieldName: 'lastName',
      value: capitalizeName(patientColonMatch[2]),
      confidence: 0.95,
      matchContext: getMatchContext(text, patientColonMatch.index || 0),
    };
    nameFound = true;
  }

  // Strategy 3: "Dear Dr. X, I am referring FirstName LastName"
  const dearDoctorMatch = text.match(patterns.dearDoctorPattern);
  if (dearDoctorMatch && !nameFound) {
    data.firstName = {
      fieldName: 'firstName',
      value: capitalizeName(dearDoctorMatch[1]),
      confidence: 0.90,
      matchContext: getMatchContext(text, dearDoctorMatch.index || 0),
    };
    data.lastName = {
      fieldName: 'lastName',
      value: capitalizeName(dearDoctorMatch[2]),
      confidence: 0.90,
      matchContext: getMatchContext(text, dearDoctorMatch.index || 0),
    };
    nameFound = true;
  }

  // Strategy 4: "referring FirstName LastName"
  const referringMatch = text.match(patterns.referringPattern);
  if (referringMatch && !nameFound) {
    data.firstName = {
      fieldName: 'firstName',
      value: capitalizeName(referringMatch[1]),
      confidence: 0.85,
      matchContext: getMatchContext(text, referringMatch.index || 0),
    };
    data.lastName = {
      fieldName: 'lastName',
      value: capitalizeName(referringMatch[2]),
      confidence: 0.85,
      matchContext: getMatchContext(text, referringMatch.index || 0),
    };
    nameFound = true;
  }

  // Strategy 5: "seeing/reviewing/assessing FirstName LastName"
  const thankYouMatch = text.match(patterns.thankYouPattern);
  if (thankYouMatch && !nameFound) {
    data.firstName = {
      fieldName: 'firstName',
      value: capitalizeName(thankYouMatch[1]),
      confidence: 0.85,
      matchContext: getMatchContext(text, thankYouMatch.index || 0),
    };
    data.lastName = {
      fieldName: 'lastName',
      value: capitalizeName(thankYouMatch[2]),
      confidence: 0.85,
      matchContext: getMatchContext(text, thankYouMatch.index || 0),
    };
    nameFound = true;
  }

  // Strategy 6: Extract full name and split into first/last (original pattern)
  const fullNameMatch = text.match(patterns.fullName);
  if (fullNameMatch && !nameFound) {
    const nameParts = fullNameMatch[1].trim().split(/\s+/);
    if (nameParts.length >= 2) {
      data.firstName = {
        fieldName: 'firstName',
        value: capitalizeName(nameParts[0]),
        confidence: 0.80,
        matchContext: getMatchContext(text, fullNameMatch.index || 0),
      };
      data.lastName = {
        fieldName: 'lastName',
        value: capitalizeName(nameParts[nameParts.length - 1]),
        confidence: 0.80,
        matchContext: getMatchContext(text, fullNameMatch.index || 0),
      };
      nameFound = true;
    }
  }

  // Strategy 7: ALL CAPS name on its own line (e.g., "JOHN SMITH")
  const allCapsMatch = text.match(patterns.allCapsName);
  if (allCapsMatch && !nameFound) {
    // Verify it looks like a name (not headers like "REFERRAL LETTER")
    const first = allCapsMatch[1];
    const last = allCapsMatch[2];
    const excludeWords = ['REFERRAL', 'LETTER', 'PATIENT', 'DOCTOR', 'HOSPITAL', 'CLINIC', 'MEDICAL', 'CENTER', 'HEALTH', 'PRIVATE', 'DEAR', 'DATE', 'FROM', 'ADDRESS', 'PHONE'];
    if (!excludeWords.includes(first) && !excludeWords.includes(last)) {
      data.firstName = {
        fieldName: 'firstName',
        value: capitalizeName(first),
        confidence: 0.70,
        matchContext: getMatchContext(text, allCapsMatch.index || 0),
      };
      data.lastName = {
        fieldName: 'lastName',
        value: capitalizeName(last),
        confidence: 0.70,
        matchContext: getMatchContext(text, allCapsMatch.index || 0),
      };
      nameFound = true;
    }
  }

  // Try individual name fields (higher confidence if found - overrides previous)
  const firstNameMatch = text.match(patterns.firstName);
  if (firstNameMatch) {
    data.firstName = {
      fieldName: 'firstName',
      value: capitalizeName(firstNameMatch[1].trim()),
      confidence: 0.95,
      matchContext: getMatchContext(text, firstNameMatch.index || 0),
    };
  }

  const lastNameMatch = text.match(patterns.lastName);
  if (lastNameMatch) {
    data.lastName = {
      fieldName: 'lastName',
      value: capitalizeName(lastNameMatch[1].trim()),
      confidence: 0.95,
      matchContext: getMatchContext(text, lastNameMatch.index || 0),
    };
  }

  // Date of birth
  const dobMatch = text.match(patterns.dateOfBirth);
  if (dobMatch) {
    data.dateOfBirth = {
      fieldName: 'dateOfBirth',
      value: normalizeDate(dobMatch[1]),
      confidence: 0.9,
      matchContext: getMatchContext(text, dobMatch.index || 0),
    };
  }

  // Gender
  const genderMatch = text.match(patterns.gender);
  if (genderMatch) {
    data.gender = {
      fieldName: 'gender',
      value: normalizeGender(genderMatch[1]),
      confidence: 0.95,
      matchContext: getMatchContext(text, genderMatch.index || 0),
    };
  }

  // Phone
  const phoneMatch = text.match(patterns.phone);
  if (phoneMatch) {
    const phoneNumber = phoneMatch[0].match(patterns.phoneNumber);
    if (phoneNumber) {
      data.phone = {
        fieldName: 'phone',
        value: normalizePhone(phoneNumber[0]),
        confidence: 0.9,
        matchContext: getMatchContext(text, phoneMatch.index || 0),
      };
    }
  }

  // Email
  const emailMatch = text.match(patterns.email);
  if (emailMatch) {
    data.email = {
      fieldName: 'email',
      value: emailMatch[1].toLowerCase(),
      confidence: 0.95,
      matchContext: getMatchContext(text, emailMatch.index || 0),
    };
  } else {
    // Try standalone email pattern
    const emailStandalone = text.match(patterns.emailStandalone);
    if (emailStandalone) {
      data.email = {
        fieldName: 'email',
        value: emailStandalone[0].toLowerCase(),
        confidence: 0.8,
        matchContext: getMatchContext(text, emailStandalone.index || 0),
      };
    }
  }

  // Address
  const addressMatch = text.match(patterns.addressLine1);
  if (addressMatch) {
    data.addressLine1 = {
      fieldName: 'addressLine1',
      value: addressMatch[1].trim(),
      confidence: 0.85,
      matchContext: getMatchContext(text, addressMatch.index || 0),
    };
  }

  // City, State, Zip
  const cityStateZipMatch = text.match(patterns.cityStateZip);
  if (cityStateZipMatch) {
    data.city = {
      fieldName: 'city',
      value: cityStateZipMatch[1].trim(),
      confidence: 0.9,
      matchContext: getMatchContext(text, cityStateZipMatch.index || 0),
    };
    data.state = {
      fieldName: 'state',
      value: cityStateZipMatch[2],
      confidence: 0.95,
      matchContext: getMatchContext(text, cityStateZipMatch.index || 0),
    };
    data.zip = {
      fieldName: 'zip',
      value: cityStateZipMatch[3],
      confidence: 0.95,
      matchContext: getMatchContext(text, cityStateZipMatch.index || 0),
    };
  }

  // Insurance
  const insuranceProviderMatch = text.match(patterns.insuranceProvider);
  if (insuranceProviderMatch) {
    data.insuranceProvider = {
      fieldName: 'insuranceProvider',
      value: insuranceProviderMatch[1].trim(),
      confidence: 0.85,
      matchContext: getMatchContext(text, insuranceProviderMatch.index || 0),
    };
  }

  const insuranceIdMatch = text.match(patterns.insuranceId);
  if (insuranceIdMatch) {
    data.insuranceId = {
      fieldName: 'insuranceId',
      value: insuranceIdMatch[1].trim(),
      confidence: 0.9,
      matchContext: getMatchContext(text, insuranceIdMatch.index || 0),
    };
  }

  // Emergency contact
  const emergencyNameMatch = text.match(patterns.emergencyContactName);
  if (emergencyNameMatch) {
    data.emergencyContactName = {
      fieldName: 'emergencyContactName',
      value: emergencyNameMatch[1].trim(),
      confidence: 0.85,
      matchContext: getMatchContext(text, emergencyNameMatch.index || 0),
    };
  }

  const emergencyPhoneMatch = text.match(patterns.emergencyContactPhone);
  if (emergencyPhoneMatch) {
    const phoneNumber = emergencyPhoneMatch[0].match(patterns.phoneNumber);
    if (phoneNumber) {
      data.emergencyContactPhone = {
        fieldName: 'emergencyContactPhone',
        value: normalizePhone(phoneNumber[0]),
        confidence: 0.85,
        matchContext: getMatchContext(text, emergencyPhoneMatch.index || 0),
      };
    }
  }

  return data;
}

export function extractReferralData(text: string): ExtractedReferralData {
  const data: ExtractedReferralData = {};

  const physicianMatch = text.match(patterns.referringPhysician);
  if (physicianMatch) {
    data.referringPhysician = {
      fieldName: 'referringPhysician',
      value: physicianMatch[1].trim(),
      confidence: 0.85,
      matchContext: getMatchContext(text, physicianMatch.index || 0),
    };
  }

  const facilityMatch = text.match(patterns.referringFacility);
  if (facilityMatch) {
    data.referringFacility = {
      fieldName: 'referringFacility',
      value: facilityMatch[1].trim(),
      confidence: 0.8,
      matchContext: getMatchContext(text, facilityMatch.index || 0),
    };
  }

  const reasonMatch = text.match(patterns.reasonForReferral);
  if (reasonMatch) {
    data.reasonForReferral = {
      fieldName: 'reasonForReferral',
      value: reasonMatch[1].trim().replace(/\s+/g, ' '),
      confidence: 0.75,
      matchContext: getMatchContext(text, reasonMatch.index || 0),
    };
  }

  return data;
}

export function extractLabData(text: string): ExtractedLabData {
  const data: ExtractedLabData = {
    testResults: [],
  };

  const labNameMatch = text.match(patterns.labName);
  if (labNameMatch) {
    data.labName = {
      fieldName: 'labName',
      value: labNameMatch[1].trim(),
      confidence: 0.85,
      matchContext: getMatchContext(text, labNameMatch.index || 0),
    };
  }

  const testDateMatch = text.match(patterns.testDate);
  if (testDateMatch) {
    data.testDate = {
      fieldName: 'testDate',
      value: normalizeDate(testDateMatch[1]),
      confidence: 0.9,
      matchContext: getMatchContext(text, testDateMatch.index || 0),
    };
  }

  // Common lab tests to look for
  const commonTests = [
    'glucose', 'hemoglobin', 'hematocrit', 'wbc', 'rbc', 'platelet',
    'sodium', 'potassium', 'chloride', 'co2', 'bun', 'creatinine',
    'calcium', 'protein', 'albumin', 'bilirubin', 'alkaline phosphatase',
    'ast', 'alt', 'ldh', 'cholesterol', 'triglyceride', 'hdl', 'ldl',
    'tsh', 't3', 't4', 'hba1c', 'a1c', 'psa', 'vitamin d', 'vitamin b12',
    'iron', 'ferritin', 'magnesium', 'phosphorus', 'uric acid',
  ];

  // Look for lab result patterns
  const lines = text.split('\n');
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    for (const test of commonTests) {
      if (lowerLine.includes(test)) {
        // Try to extract the value
        const valueMatch = line.match(/(\d+\.?\d*)\s*([a-zA-Z\/%]+)?/);
        if (valueMatch) {
          const referenceMatch = line.match(/\(?\s*(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*\)?/);
          const isAbnormal = /\b(high|low|abnormal|h|l|\*)\b/i.test(line);

          data.testResults.push({
            testName: test.toUpperCase(),
            value: valueMatch[1],
            unit: valueMatch[2] || '',
            referenceRange: referenceMatch ? `${referenceMatch[1]}-${referenceMatch[2]}` : '',
            abnormal: isAbnormal,
          });
          break;
        }
      }
    }
  }

  return data;
}

export function extractAllData(text: string, documentType: string): {
  patientData: ExtractedPatientData;
  referralData: ExtractedReferralData | null;
  labData: ExtractedLabData | null;
} {
  const patientData = extractPatientData(text);

  let referralData: ExtractedReferralData | null = null;
  let labData: ExtractedLabData | null = null;

  if (documentType === 'referral') {
    referralData = extractReferralData(text);
  } else if (documentType === 'lab_result') {
    labData = extractLabData(text);
  }

  return { patientData, referralData, labData };
}
