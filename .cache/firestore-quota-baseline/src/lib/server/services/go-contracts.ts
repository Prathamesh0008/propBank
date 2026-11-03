// Generated from unchanged Go model tags by scripts/generate-native-contracts.cjs.
// Projections deliberately retain omissions in the Go handlers.
export interface GoField { go: string; type: string; name: string; omit: boolean; store: string; storeOmit: boolean }
export const schemas: Record<string, GoField[]> = {
  "Property": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "Title",
      "type": "string",
      "name": "title",
      "omit": false,
      "store": "title",
      "storeOmit": false
    },
    {
      "go": "PropertyType",
      "type": "string",
      "name": "propertyType",
      "omit": false,
      "store": "propertyType",
      "storeOmit": false
    },
    {
      "go": "Configuration",
      "type": "string",
      "name": "configuration",
      "omit": false,
      "store": "configuration",
      "storeOmit": false
    },
    {
      "go": "ListingType",
      "type": "string",
      "name": "listingType",
      "omit": false,
      "store": "listingType",
      "storeOmit": false
    },
    {
      "go": "UnitNumber",
      "type": "string",
      "name": "unitNumber",
      "omit": false,
      "store": "unitNumber",
      "storeOmit": false
    },
    {
      "go": "Floor",
      "type": "string",
      "name": "floor",
      "omit": false,
      "store": "floor",
      "storeOmit": false
    },
    {
      "go": "Location",
      "type": "string",
      "name": "location",
      "omit": false,
      "store": "location",
      "storeOmit": false
    },
    {
      "go": "Address",
      "type": "string",
      "name": "address",
      "omit": false,
      "store": "address",
      "storeOmit": false
    },
    {
      "go": "City",
      "type": "string",
      "name": "city",
      "omit": false,
      "store": "city",
      "storeOmit": false
    },
    {
      "go": "State",
      "type": "string",
      "name": "state",
      "omit": false,
      "store": "state",
      "storeOmit": false
    },
    {
      "go": "ZipCode",
      "type": "string",
      "name": "zipCode",
      "omit": false,
      "store": "zipCode",
      "storeOmit": false
    },
    {
      "go": "CarpetArea",
      "type": "string",
      "name": "carpetArea",
      "omit": false,
      "store": "carpetArea",
      "storeOmit": false
    },
    {
      "go": "ConstructedArea",
      "type": "string",
      "name": "constructedArea",
      "omit": false,
      "store": "constructedArea",
      "storeOmit": false
    },
    {
      "go": "SquareFeet",
      "type": "int",
      "name": "squareFeet",
      "omit": false,
      "store": "squareFeet",
      "storeOmit": false
    },
    {
      "go": "TenantName",
      "type": "string",
      "name": "tenantName",
      "omit": false,
      "store": "tenantName",
      "storeOmit": false
    },
    {
      "go": "TenantEmail",
      "type": "string",
      "name": "tenantEmail",
      "omit": false,
      "store": "tenantEmail",
      "storeOmit": false
    },
    {
      "go": "PersonName",
      "type": "string",
      "name": "personName",
      "omit": false,
      "store": "personName",
      "storeOmit": false
    },
    {
      "go": "MobileNumber",
      "type": "string",
      "name": "mobileNumber",
      "omit": false,
      "store": "mobileNumber",
      "storeOmit": false
    },
    {
      "go": "PrimaryNo",
      "type": "string",
      "name": "primaryNo",
      "omit": false,
      "store": "primaryNo",
      "storeOmit": false
    },
    {
      "go": "UltNo",
      "type": "string",
      "name": "ultNo",
      "omit": false,
      "store": "ultNo",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent",
      "type": "string",
      "name": "monthlyRent",
      "omit": false,
      "store": "monthlyRent",
      "storeOmit": false
    },
    {
      "go": "SellingPrice",
      "type": "string",
      "name": "sellingPrice",
      "omit": false,
      "store": "sellingPrice",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent1stYear",
      "type": "string",
      "name": "monthlyRent1stYear",
      "omit": false,
      "store": "monthlyRent1stYear",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent2ndYear",
      "type": "string",
      "name": "monthlyRent2ndYear",
      "omit": false,
      "store": "monthlyRent2ndYear",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent3rdYear",
      "type": "string",
      "name": "monthlyRent3rdYear",
      "omit": false,
      "store": "monthlyRent3rdYear",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent4thYear",
      "type": "string",
      "name": "monthlyRent4thYear",
      "omit": false,
      "store": "monthlyRent4thYear",
      "storeOmit": false
    },
    {
      "go": "RentFromDate1",
      "type": "string",
      "name": "rentFromDate1",
      "omit": false,
      "store": "rentFromDate1",
      "storeOmit": false
    },
    {
      "go": "RentToDate1",
      "type": "string",
      "name": "rentToDate1",
      "omit": false,
      "store": "rentToDate1",
      "storeOmit": false
    },
    {
      "go": "RentFromDate2",
      "type": "string",
      "name": "rentFromDate2",
      "omit": false,
      "store": "rentFromDate2",
      "storeOmit": false
    },
    {
      "go": "RentToDate2",
      "type": "string",
      "name": "rentToDate2",
      "omit": false,
      "store": "rentToDate2",
      "storeOmit": false
    },
    {
      "go": "RentSchedule",
      "type": "[]RentScheduleItem",
      "name": "rentSchedule",
      "omit": false,
      "store": "rentSchedule",
      "storeOmit": false
    },
    {
      "go": "PaymentDueDate",
      "type": "string",
      "name": "paymentDueDate",
      "omit": false,
      "store": "paymentDueDate",
      "storeOmit": false
    },
    {
      "go": "EscalationPercentage",
      "type": "string",
      "name": "escalationPercentage",
      "omit": false,
      "store": "escalationPercentage",
      "storeOmit": false
    },
    {
      "go": "EscalationAmount",
      "type": "string",
      "name": "escalationAmount",
      "omit": false,
      "store": "escalationAmount",
      "storeOmit": false
    },
    {
      "go": "SecurityDeposit",
      "type": "string",
      "name": "securityDeposit",
      "omit": false,
      "store": "securityDeposit",
      "storeOmit": false
    },
    {
      "go": "AgreementPeriod",
      "type": "string",
      "name": "agreementPeriod",
      "omit": false,
      "store": "agreementPeriod",
      "storeOmit": false
    },
    {
      "go": "AgreementStartDate",
      "type": "string",
      "name": "agreementStartDate",
      "omit": false,
      "store": "agreementStartDate",
      "storeOmit": false
    },
    {
      "go": "AgreementEndDate",
      "type": "string",
      "name": "agreementEndDate",
      "omit": false,
      "store": "agreementEndDate",
      "storeOmit": false
    },
    {
      "go": "NoticePeriod",
      "type": "string",
      "name": "noticePeriod",
      "omit": false,
      "store": "noticePeriod",
      "storeOmit": false
    },
    {
      "go": "LockInPeriod",
      "type": "string",
      "name": "lockInPeriod",
      "omit": false,
      "store": "lockInPeriod",
      "storeOmit": false
    },
    {
      "go": "UnitCondition",
      "type": "string",
      "name": "unitCondition",
      "omit": false,
      "store": "unitCondition",
      "storeOmit": false
    },
    {
      "go": "MaintenanceToBePaidBy",
      "type": "string",
      "name": "maintenanceToBePaidBy",
      "omit": false,
      "store": "maintenanceToBePaidBy",
      "storeOmit": false
    },
    {
      "go": "ProjectCondition",
      "type": "string",
      "name": "projectCondition",
      "omit": false,
      "store": "projectCondition",
      "storeOmit": false
    },
    {
      "go": "InternalImages",
      "type": "[]string",
      "name": "internalImages",
      "omit": false,
      "store": "internalImages",
      "storeOmit": false
    },
    {
      "go": "PossessionDate",
      "type": "string",
      "name": "possessionDate",
      "omit": false,
      "store": "possessionDate",
      "storeOmit": false
    },
    {
      "go": "RentalStatus",
      "type": "string",
      "name": "rentalStatus",
      "omit": false,
      "store": "rentalStatus",
      "storeOmit": false
    },
    {
      "go": "AgreementStatus",
      "type": "string",
      "name": "agreementStatus",
      "omit": false,
      "store": "agreementStatus",
      "storeOmit": false
    },
    {
      "go": "AnticipatedTerminationDate",
      "type": "string",
      "name": "anticipatedTerminationDate",
      "omit": false,
      "store": "anticipatedTerminationDate",
      "storeOmit": false
    },
    {
      "go": "FurnishedChecklist",
      "type": "[]FurnishedItem",
      "name": "furnishedChecklist",
      "omit": false,
      "store": "furnishedChecklist",
      "storeOmit": false
    },
    {
      "go": "Description",
      "type": "string",
      "name": "description",
      "omit": false,
      "store": "description",
      "storeOmit": false
    },
    {
      "go": "Price",
      "type": "float64",
      "name": "price",
      "omit": false,
      "store": "price",
      "storeOmit": false
    },
    {
      "go": "Bedrooms",
      "type": "int",
      "name": "bedrooms",
      "omit": false,
      "store": "bedrooms",
      "storeOmit": false
    },
    {
      "go": "Bathrooms",
      "type": "float64",
      "name": "bathrooms",
      "omit": false,
      "store": "bathrooms",
      "storeOmit": false
    },
    {
      "go": "Images",
      "type": "[]string",
      "name": "images",
      "omit": false,
      "store": "images",
      "storeOmit": false
    },
    {
      "go": "SpecificComments",
      "type": "string",
      "name": "specificComments",
      "omit": false,
      "store": "specificComments",
      "storeOmit": false
    },
    {
      "go": "Tenants",
      "type": "[]TenantInfo",
      "name": "tenants",
      "omit": false,
      "store": "tenants",
      "storeOmit": false
    },
    {
      "go": "Buyers",
      "type": "[]BuyerInfo",
      "name": "buyers",
      "omit": false,
      "store": "buyers",
      "storeOmit": false
    },
    {
      "go": "OwnerUID",
      "type": "string",
      "name": "ownerUID",
      "omit": false,
      "store": "ownerUID",
      "storeOmit": false
    },
    {
      "go": "OwnerName",
      "type": "string",
      "name": "ownerName",
      "omit": false,
      "store": "ownerName",
      "storeOmit": false
    },
    {
      "go": "OwnerEmail",
      "type": "string",
      "name": "ownerEmail",
      "omit": false,
      "store": "ownerEmail",
      "storeOmit": false
    },
    {
      "go": "OwnerPhone",
      "type": "string",
      "name": "ownerPhone",
      "omit": false,
      "store": "ownerPhone",
      "storeOmit": false
    },
    {
      "go": "OwnerRole",
      "type": "string",
      "name": "ownerRole",
      "omit": false,
      "store": "ownerRole",
      "storeOmit": false
    },
    {
      "go": "WantToSell",
      "type": "bool",
      "name": "wantToSell",
      "omit": false,
      "store": "wantToSell",
      "storeOmit": false
    },
    {
      "go": "Status",
      "type": "string",
      "name": "status",
      "omit": false,
      "store": "status",
      "storeOmit": false
    },
    {
      "go": "IsActive",
      "type": "bool",
      "name": "isActive",
      "omit": false,
      "store": "isActive",
      "storeOmit": false
    },
    {
      "go": "IsSold",
      "type": "bool",
      "name": "isSold",
      "omit": false,
      "store": "isSold",
      "storeOmit": false
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    },
    {
      "go": "IsPreLeased",
      "type": "bool",
      "name": "isPreLeased",
      "omit": false,
      "store": "isPreLeased",
      "storeOmit": false
    },
    {
      "go": "PreLeasedType",
      "type": "string",
      "name": "preLeasedType",
      "omit": false,
      "store": "preLeasedType",
      "storeOmit": false
    },
    {
      "go": "AgreementTerm",
      "type": "string",
      "name": "agreementTerm",
      "omit": false,
      "store": "agreementTerm",
      "storeOmit": false
    },
    {
      "go": "LockInPeriodPreLeased",
      "type": "string",
      "name": "lockInPeriodPreLeased",
      "omit": false,
      "store": "lockInPeriodPreLeased",
      "storeOmit": false
    },
    {
      "go": "RentalIncome",
      "type": "string",
      "name": "rentalIncome",
      "omit": false,
      "store": "rentalIncome",
      "storeOmit": false
    },
    {
      "go": "Escalation",
      "type": "string",
      "name": "escalation",
      "omit": false,
      "store": "escalation",
      "storeOmit": false
    },
    {
      "go": "TenantDetails",
      "type": "string",
      "name": "tenantDetails",
      "omit": false,
      "store": "tenantDetails",
      "storeOmit": false
    },
    {
      "go": "Purpose",
      "type": "string",
      "name": "purpose",
      "omit": false,
      "store": "purpose",
      "storeOmit": false
    },
    {
      "go": "SpecificRequirement",
      "type": "string",
      "name": "specificRequirement",
      "omit": false,
      "store": "specificRequirement",
      "storeOmit": false
    }
  ],
  "PropertyResponse": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "Title",
      "type": "string",
      "name": "title",
      "omit": false,
      "store": "title",
      "storeOmit": false
    },
    {
      "go": "Description",
      "type": "string",
      "name": "description",
      "omit": false,
      "store": "description",
      "storeOmit": false
    },
    {
      "go": "Price",
      "type": "float64",
      "name": "price",
      "omit": false,
      "store": "price",
      "storeOmit": false
    },
    {
      "go": "Address",
      "type": "string",
      "name": "address",
      "omit": false,
      "store": "address",
      "storeOmit": false
    },
    {
      "go": "City",
      "type": "string",
      "name": "city",
      "omit": false,
      "store": "city",
      "storeOmit": false
    },
    {
      "go": "State",
      "type": "string",
      "name": "state",
      "omit": false,
      "store": "state",
      "storeOmit": false
    },
    {
      "go": "ZipCode",
      "type": "string",
      "name": "zipCode",
      "omit": false,
      "store": "zipCode",
      "storeOmit": false
    },
    {
      "go": "PropertyType",
      "type": "string",
      "name": "propertyType",
      "omit": false,
      "store": "propertyType",
      "storeOmit": false
    },
    {
      "go": "ListingType",
      "type": "string",
      "name": "listingType",
      "omit": false,
      "store": "listingType",
      "storeOmit": false
    },
    {
      "go": "Configuration",
      "type": "string",
      "name": "configuration",
      "omit": false,
      "store": "configuration",
      "storeOmit": false
    },
    {
      "go": "UnitNumber",
      "type": "string",
      "name": "unitNumber",
      "omit": false,
      "store": "unitNumber",
      "storeOmit": false
    },
    {
      "go": "Floor",
      "type": "string",
      "name": "floor",
      "omit": false,
      "store": "floor",
      "storeOmit": false
    },
    {
      "go": "Location",
      "type": "string",
      "name": "location",
      "omit": false,
      "store": "location",
      "storeOmit": false
    },
    {
      "go": "CarpetArea",
      "type": "string",
      "name": "carpetArea",
      "omit": false,
      "store": "carpetArea",
      "storeOmit": false
    },
    {
      "go": "ConstructedArea",
      "type": "string",
      "name": "constructedArea",
      "omit": false,
      "store": "constructedArea",
      "storeOmit": false
    },
    {
      "go": "SquareFeet",
      "type": "int",
      "name": "squareFeet",
      "omit": false,
      "store": "squareFeet",
      "storeOmit": false
    },
    {
      "go": "TenantName",
      "type": "string",
      "name": "tenantName",
      "omit": false,
      "store": "tenantName",
      "storeOmit": false
    },
    {
      "go": "PersonName",
      "type": "string",
      "name": "personName",
      "omit": false,
      "store": "personName",
      "storeOmit": false
    },
    {
      "go": "MobileNumber",
      "type": "string",
      "name": "mobileNumber",
      "omit": false,
      "store": "mobileNumber",
      "storeOmit": false
    },
    {
      "go": "PrimaryNo",
      "type": "string",
      "name": "primaryNo",
      "omit": false,
      "store": "primaryNo",
      "storeOmit": false
    },
    {
      "go": "UltNo",
      "type": "string",
      "name": "ultNo",
      "omit": false,
      "store": "ultNo",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent",
      "type": "string",
      "name": "monthlyRent",
      "omit": false,
      "store": "monthlyRent",
      "storeOmit": false
    },
    {
      "go": "SellingPrice",
      "type": "string",
      "name": "sellingPrice",
      "omit": false,
      "store": "sellingPrice",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent1stYear",
      "type": "string",
      "name": "monthlyRent1stYear",
      "omit": false,
      "store": "monthlyRent1stYear",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent2ndYear",
      "type": "string",
      "name": "monthlyRent2ndYear",
      "omit": false,
      "store": "monthlyRent2ndYear",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent3rdYear",
      "type": "string",
      "name": "monthlyRent3rdYear",
      "omit": false,
      "store": "monthlyRent3rdYear",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent4thYear",
      "type": "string",
      "name": "monthlyRent4thYear",
      "omit": false,
      "store": "monthlyRent4thYear",
      "storeOmit": false
    },
    {
      "go": "RentFromDate1",
      "type": "string",
      "name": "rentFromDate1",
      "omit": false,
      "store": "rentFromDate1",
      "storeOmit": false
    },
    {
      "go": "RentToDate1",
      "type": "string",
      "name": "rentToDate1",
      "omit": false,
      "store": "rentToDate1",
      "storeOmit": false
    },
    {
      "go": "RentFromDate2",
      "type": "string",
      "name": "rentFromDate2",
      "omit": false,
      "store": "rentFromDate2",
      "storeOmit": false
    },
    {
      "go": "RentToDate2",
      "type": "string",
      "name": "rentToDate2",
      "omit": false,
      "store": "rentToDate2",
      "storeOmit": false
    },
    {
      "go": "RentSchedule",
      "type": "[]RentScheduleItem",
      "name": "rentSchedule",
      "omit": false,
      "store": "rentSchedule",
      "storeOmit": false
    },
    {
      "go": "PaymentDueDate",
      "type": "string",
      "name": "paymentDueDate",
      "omit": false,
      "store": "paymentDueDate",
      "storeOmit": false
    },
    {
      "go": "EscalationPercentage",
      "type": "string",
      "name": "escalationPercentage",
      "omit": false,
      "store": "escalationPercentage",
      "storeOmit": false
    },
    {
      "go": "EscalationAmount",
      "type": "string",
      "name": "escalationAmount",
      "omit": false,
      "store": "escalationAmount",
      "storeOmit": false
    },
    {
      "go": "SecurityDeposit",
      "type": "string",
      "name": "securityDeposit",
      "omit": false,
      "store": "securityDeposit",
      "storeOmit": false
    },
    {
      "go": "AgreementPeriod",
      "type": "string",
      "name": "agreementPeriod",
      "omit": false,
      "store": "agreementPeriod",
      "storeOmit": false
    },
    {
      "go": "AgreementStartDate",
      "type": "string",
      "name": "agreementStartDate",
      "omit": false,
      "store": "agreementStartDate",
      "storeOmit": false
    },
    {
      "go": "AgreementEndDate",
      "type": "string",
      "name": "agreementEndDate",
      "omit": false,
      "store": "agreementEndDate",
      "storeOmit": false
    },
    {
      "go": "NoticePeriod",
      "type": "string",
      "name": "noticePeriod",
      "omit": false,
      "store": "noticePeriod",
      "storeOmit": false
    },
    {
      "go": "LockInPeriod",
      "type": "string",
      "name": "lockInPeriod",
      "omit": false,
      "store": "lockInPeriod",
      "storeOmit": false
    },
    {
      "go": "UnitCondition",
      "type": "string",
      "name": "unitCondition",
      "omit": false,
      "store": "unitCondition",
      "storeOmit": false
    },
    {
      "go": "MaintenanceToBePaidBy",
      "type": "string",
      "name": "maintenanceToBePaidBy",
      "omit": false,
      "store": "maintenanceToBePaidBy",
      "storeOmit": false
    },
    {
      "go": "ProjectCondition",
      "type": "string",
      "name": "projectCondition",
      "omit": false,
      "store": "projectCondition",
      "storeOmit": false
    },
    {
      "go": "InternalImages",
      "type": "[]string",
      "name": "internalImages",
      "omit": false,
      "store": "internalImages",
      "storeOmit": false
    },
    {
      "go": "PossessionDate",
      "type": "string",
      "name": "possessionDate",
      "omit": false,
      "store": "possessionDate",
      "storeOmit": false
    },
    {
      "go": "RentalStatus",
      "type": "string",
      "name": "rentalStatus",
      "omit": false,
      "store": "rentalStatus",
      "storeOmit": false
    },
    {
      "go": "FurnishedChecklist",
      "type": "[]FurnishedItem",
      "name": "furnishedChecklist",
      "omit": false,
      "store": "furnishedChecklist",
      "storeOmit": false
    },
    {
      "go": "Images",
      "type": "[]string",
      "name": "images",
      "omit": false,
      "store": "images",
      "storeOmit": false
    },
    {
      "go": "SpecificComments",
      "type": "string",
      "name": "specificComments",
      "omit": false,
      "store": "specificComments",
      "storeOmit": false
    },
    {
      "go": "Tenants",
      "type": "[]TenantInfo",
      "name": "tenants",
      "omit": false,
      "store": "tenants",
      "storeOmit": false
    },
    {
      "go": "Buyers",
      "type": "[]BuyerInfo",
      "name": "buyers",
      "omit": false,
      "store": "buyers",
      "storeOmit": false
    },
    {
      "go": "OwnerUID",
      "type": "string",
      "name": "ownerUID",
      "omit": false,
      "store": "ownerUID",
      "storeOmit": false
    },
    {
      "go": "OwnerName",
      "type": "string",
      "name": "ownerName",
      "omit": false,
      "store": "ownerName",
      "storeOmit": false
    },
    {
      "go": "OwnerEmail",
      "type": "string",
      "name": "ownerEmail",
      "omit": false,
      "store": "ownerEmail",
      "storeOmit": false
    },
    {
      "go": "OwnerPhone",
      "type": "string",
      "name": "ownerPhone",
      "omit": false,
      "store": "ownerPhone",
      "storeOmit": false
    },
    {
      "go": "OwnerRole",
      "type": "string",
      "name": "ownerRole",
      "omit": false,
      "store": "ownerRole",
      "storeOmit": false
    },
    {
      "go": "WantToSell",
      "type": "bool",
      "name": "wantToSell",
      "omit": false,
      "store": "wantToSell",
      "storeOmit": false
    },
    {
      "go": "Status",
      "type": "string",
      "name": "status",
      "omit": false,
      "store": "status",
      "storeOmit": false
    },
    {
      "go": "IsActive",
      "type": "bool",
      "name": "isActive",
      "omit": false,
      "store": "isActive",
      "storeOmit": false
    },
    {
      "go": "IsSold",
      "type": "bool",
      "name": "isSold",
      "omit": false,
      "store": "isSold",
      "storeOmit": false
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    },
    {
      "go": "Bedrooms",
      "type": "int",
      "name": "bedrooms",
      "omit": false,
      "store": "bedrooms",
      "storeOmit": false
    },
    {
      "go": "Bathrooms",
      "type": "float64",
      "name": "bathrooms",
      "omit": false,
      "store": "bathrooms",
      "storeOmit": false
    },
    {
      "go": "UserRole",
      "type": "string",
      "name": "userRole",
      "omit": true,
      "store": "userRole",
      "storeOmit": false
    },
    {
      "go": "IsPreLeased",
      "type": "bool",
      "name": "isPreLeased",
      "omit": false,
      "store": "isPreLeased",
      "storeOmit": false
    },
    {
      "go": "PreLeasedType",
      "type": "string",
      "name": "preLeasedType",
      "omit": false,
      "store": "preLeasedType",
      "storeOmit": false
    },
    {
      "go": "AgreementTerm",
      "type": "string",
      "name": "agreementTerm",
      "omit": false,
      "store": "agreementTerm",
      "storeOmit": false
    },
    {
      "go": "LockInPeriodPreLeased",
      "type": "string",
      "name": "lockInPeriodPreLeased",
      "omit": false,
      "store": "lockInPeriodPreLeased",
      "storeOmit": false
    },
    {
      "go": "RentalIncome",
      "type": "string",
      "name": "rentalIncome",
      "omit": false,
      "store": "rentalIncome",
      "storeOmit": false
    },
    {
      "go": "Escalation",
      "type": "string",
      "name": "escalation",
      "omit": false,
      "store": "escalation",
      "storeOmit": false
    },
    {
      "go": "TenantDetails",
      "type": "string",
      "name": "tenantDetails",
      "omit": false,
      "store": "tenantDetails",
      "storeOmit": false
    },
    {
      "go": "Purpose",
      "type": "string",
      "name": "purpose",
      "omit": false,
      "store": "purpose",
      "storeOmit": false
    },
    {
      "go": "SpecificRequirement",
      "type": "string",
      "name": "specificRequirement",
      "omit": false,
      "store": "specificRequirement",
      "storeOmit": false
    }
  ],
  "CreatePropertyRequest": [
    {
      "go": "PropertyTitle",
      "type": "string",
      "name": "propertyTitle",
      "omit": false,
      "store": "propertyTitle",
      "storeOmit": false
    },
    {
      "go": "PropertyType",
      "type": "string",
      "name": "propertyType",
      "omit": false,
      "store": "propertyType",
      "storeOmit": false
    },
    {
      "go": "Configuration",
      "type": "string",
      "name": "configuration",
      "omit": false,
      "store": "configuration",
      "storeOmit": false
    },
    {
      "go": "ListingType",
      "type": "string",
      "name": "listingType",
      "omit": false,
      "store": "listingType",
      "storeOmit": false
    },
    {
      "go": "UnitNumber",
      "type": "string",
      "name": "unitNumber",
      "omit": false,
      "store": "unitNumber",
      "storeOmit": false
    },
    {
      "go": "Floor",
      "type": "string",
      "name": "floor",
      "omit": false,
      "store": "floor",
      "storeOmit": false
    },
    {
      "go": "Location",
      "type": "string",
      "name": "location",
      "omit": false,
      "store": "location",
      "storeOmit": false
    },
    {
      "go": "CarpetArea",
      "type": "string",
      "name": "carpetArea",
      "omit": false,
      "store": "carpetArea",
      "storeOmit": false
    },
    {
      "go": "ConstructedArea",
      "type": "string",
      "name": "constructedArea",
      "omit": false,
      "store": "constructedArea",
      "storeOmit": false
    },
    {
      "go": "TenantFirstName",
      "type": "string",
      "name": "tenantFirstName",
      "omit": false,
      "store": "tenantFirstName",
      "storeOmit": false
    },
    {
      "go": "TenantLastName",
      "type": "string",
      "name": "tenantLastName",
      "omit": false,
      "store": "tenantLastName",
      "storeOmit": false
    },
    {
      "go": "TenantName",
      "type": "string",
      "name": "tenantName",
      "omit": false,
      "store": "tenantName",
      "storeOmit": false
    },
    {
      "go": "TenantEmail",
      "type": "string",
      "name": "tenantEmail",
      "omit": false,
      "store": "tenantEmail",
      "storeOmit": false
    },
    {
      "go": "PersonName",
      "type": "string",
      "name": "personName",
      "omit": false,
      "store": "personName",
      "storeOmit": false
    },
    {
      "go": "MobileNumber",
      "type": "string",
      "name": "mobileNumber",
      "omit": false,
      "store": "mobileNumber",
      "storeOmit": false
    },
    {
      "go": "PrimaryNo",
      "type": "string",
      "name": "primaryNo",
      "omit": false,
      "store": "primaryNo",
      "storeOmit": false
    },
    {
      "go": "UltNo",
      "type": "string",
      "name": "ultNo",
      "omit": false,
      "store": "ultNo",
      "storeOmit": false
    },
    {
      "go": "TenantEmergencyContact",
      "type": "string",
      "name": "tenantEmergencyContact",
      "omit": false,
      "store": "tenantEmergencyContact",
      "storeOmit": false
    },
    {
      "go": "TenantPreviousAddress",
      "type": "string",
      "name": "tenantPreviousAddress",
      "omit": false,
      "store": "tenantPreviousAddress",
      "storeOmit": false
    },
    {
      "go": "TenantEmploymentStatus",
      "type": "string",
      "name": "tenantEmploymentStatus",
      "omit": false,
      "store": "tenantEmploymentStatus",
      "storeOmit": false
    },
    {
      "go": "TenantEmployer",
      "type": "string",
      "name": "tenantEmployer",
      "omit": false,
      "store": "tenantEmployer",
      "storeOmit": false
    },
    {
      "go": "TenantMonthlyIncome",
      "type": "string",
      "name": "tenantMonthlyIncome",
      "omit": false,
      "store": "tenantMonthlyIncome",
      "storeOmit": false
    },
    {
      "go": "TenantIsMarried",
      "type": "bool",
      "name": "tenantIsMarried",
      "omit": false,
      "store": "tenantIsMarried",
      "storeOmit": false
    },
    {
      "go": "TenantSpouse",
      "type": "*SpouseInfo",
      "name": "tenantSpouse",
      "omit": false,
      "store": "tenantSpouse",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent",
      "type": "string",
      "name": "monthlyRent",
      "omit": false,
      "store": "monthlyRent",
      "storeOmit": false
    },
    {
      "go": "SellingPrice",
      "type": "string",
      "name": "sellingPrice",
      "omit": false,
      "store": "sellingPrice",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent1stYear",
      "type": "string",
      "name": "monthlyRent1stYear",
      "omit": false,
      "store": "monthlyRent1stYear",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent2ndYear",
      "type": "string",
      "name": "monthlyRent2ndYear",
      "omit": false,
      "store": "monthlyRent2ndYear",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent3rdYear",
      "type": "string",
      "name": "monthlyRent3rdYear",
      "omit": false,
      "store": "monthlyRent3rdYear",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent4thYear",
      "type": "string",
      "name": "monthlyRent4thYear",
      "omit": false,
      "store": "monthlyRent4thYear",
      "storeOmit": false
    },
    {
      "go": "RentFromDate1",
      "type": "string",
      "name": "rentFromDate1",
      "omit": false,
      "store": "rentFromDate1",
      "storeOmit": false
    },
    {
      "go": "RentToDate1",
      "type": "string",
      "name": "rentToDate1",
      "omit": false,
      "store": "rentToDate1",
      "storeOmit": false
    },
    {
      "go": "RentFromDate2",
      "type": "string",
      "name": "rentFromDate2",
      "omit": false,
      "store": "rentFromDate2",
      "storeOmit": false
    },
    {
      "go": "RentToDate2",
      "type": "string",
      "name": "rentToDate2",
      "omit": false,
      "store": "rentToDate2",
      "storeOmit": false
    },
    {
      "go": "RentSchedule",
      "type": "[]RentScheduleItem",
      "name": "rentSchedule",
      "omit": false,
      "store": "rentSchedule",
      "storeOmit": false
    },
    {
      "go": "PaymentDueDate",
      "type": "string",
      "name": "paymentDueDate",
      "omit": false,
      "store": "paymentDueDate",
      "storeOmit": false
    },
    {
      "go": "EscalationPercentage",
      "type": "string",
      "name": "escalationPercentage",
      "omit": false,
      "store": "escalationPercentage",
      "storeOmit": false
    },
    {
      "go": "EscalationAmount",
      "type": "string",
      "name": "escalationAmount",
      "omit": false,
      "store": "escalationAmount",
      "storeOmit": false
    },
    {
      "go": "SecurityDeposit",
      "type": "string",
      "name": "securityDeposit",
      "omit": false,
      "store": "securityDeposit",
      "storeOmit": false
    },
    {
      "go": "AgreementPeriod",
      "type": "string",
      "name": "agreementPeriod",
      "omit": false,
      "store": "agreementPeriod",
      "storeOmit": false
    },
    {
      "go": "AgreementStartDate",
      "type": "string",
      "name": "agreementStartDate",
      "omit": false,
      "store": "agreementStartDate",
      "storeOmit": false
    },
    {
      "go": "AgreementEndDate",
      "type": "string",
      "name": "agreementEndDate",
      "omit": false,
      "store": "agreementEndDate",
      "storeOmit": false
    },
    {
      "go": "NoticePeriod",
      "type": "string",
      "name": "noticePeriod",
      "omit": false,
      "store": "noticePeriod",
      "storeOmit": false
    },
    {
      "go": "LockInPeriod",
      "type": "string",
      "name": "lockInPeriod",
      "omit": false,
      "store": "lockInPeriod",
      "storeOmit": false
    },
    {
      "go": "UnitCondition",
      "type": "string",
      "name": "unitCondition",
      "omit": false,
      "store": "unitCondition",
      "storeOmit": false
    },
    {
      "go": "MaintenanceToBePaidBy",
      "type": "string",
      "name": "maintenanceToBePaidBy",
      "omit": false,
      "store": "maintenanceToBePaidBy",
      "storeOmit": false
    },
    {
      "go": "ProjectCondition",
      "type": "string",
      "name": "projectCondition",
      "omit": false,
      "store": "projectCondition",
      "storeOmit": false
    },
    {
      "go": "InternalImages",
      "type": "[]string",
      "name": "internalImages",
      "omit": false,
      "store": "internalImages",
      "storeOmit": false
    },
    {
      "go": "PossessionDate",
      "type": "string",
      "name": "possessionDate",
      "omit": false,
      "store": "possessionDate",
      "storeOmit": false
    },
    {
      "go": "RentalStatus",
      "type": "string",
      "name": "rentalStatus",
      "omit": false,
      "store": "rentalStatus",
      "storeOmit": false
    },
    {
      "go": "FurnishedChecklist",
      "type": "[]FurnishedItem",
      "name": "furnishedChecklist",
      "omit": false,
      "store": "furnishedChecklist",
      "storeOmit": false
    },
    {
      "go": "Images",
      "type": "[]string",
      "name": "images",
      "omit": false,
      "store": "images",
      "storeOmit": false
    },
    {
      "go": "SpecificComments",
      "type": "string",
      "name": "specificComments",
      "omit": false,
      "store": "specificComments",
      "storeOmit": false
    },
    {
      "go": "OwnerUID",
      "type": "string",
      "name": "ownerUID",
      "omit": false,
      "store": "ownerUID",
      "storeOmit": false
    },
    {
      "go": "IsSold",
      "type": "bool",
      "name": "isSold",
      "omit": false,
      "store": "isSold",
      "storeOmit": false
    },
    {
      "go": "BuyerFirstName",
      "type": "string",
      "name": "buyerFirstName",
      "omit": false,
      "store": "buyerFirstName",
      "storeOmit": false
    },
    {
      "go": "BuyerLastName",
      "type": "string",
      "name": "buyerLastName",
      "omit": false,
      "store": "buyerLastName",
      "storeOmit": false
    },
    {
      "go": "BuyerPhone",
      "type": "string",
      "name": "buyerPhone",
      "omit": false,
      "store": "buyerPhone",
      "storeOmit": false
    },
    {
      "go": "IsPreLeased",
      "type": "bool",
      "name": "isPreLeased",
      "omit": false,
      "store": "isPreLeased",
      "storeOmit": false
    },
    {
      "go": "PreLeasedType",
      "type": "string",
      "name": "preLeasedType",
      "omit": false,
      "store": "preLeasedType",
      "storeOmit": false
    },
    {
      "go": "AgreementTerm",
      "type": "string",
      "name": "agreementTerm",
      "omit": false,
      "store": "agreementTerm",
      "storeOmit": false
    },
    {
      "go": "LockInPeriodPreLeased",
      "type": "string",
      "name": "lockInPeriodPreLeased",
      "omit": false,
      "store": "lockInPeriodPreLeased",
      "storeOmit": false
    },
    {
      "go": "RentalIncome",
      "type": "string",
      "name": "rentalIncome",
      "omit": false,
      "store": "rentalIncome",
      "storeOmit": false
    },
    {
      "go": "Escalation",
      "type": "string",
      "name": "escalation",
      "omit": false,
      "store": "escalation",
      "storeOmit": false
    },
    {
      "go": "TenantDetails",
      "type": "string",
      "name": "tenantDetails",
      "omit": false,
      "store": "tenantDetails",
      "storeOmit": false
    },
    {
      "go": "Purpose",
      "type": "string",
      "name": "purpose",
      "omit": false,
      "store": "purpose",
      "storeOmit": false
    },
    {
      "go": "SpecificRequirement",
      "type": "string",
      "name": "specificRequirement",
      "omit": false,
      "store": "specificRequirement",
      "storeOmit": false
    }
  ],
  "User": [
    {
      "go": "UID",
      "type": "string",
      "name": "uid",
      "omit": false,
      "store": "uid",
      "storeOmit": false
    },
    {
      "go": "Email",
      "type": "string",
      "name": "email",
      "omit": false,
      "store": "email",
      "storeOmit": false
    },
    {
      "go": "Name",
      "type": "string",
      "name": "name",
      "omit": false,
      "store": "name",
      "storeOmit": false
    },
    {
      "go": "PhotoURL",
      "type": "string",
      "name": "photoURL",
      "omit": false,
      "store": "photoURL",
      "storeOmit": false
    },
    {
      "go": "PhoneNumber",
      "type": "string",
      "name": "phoneNumber",
      "omit": false,
      "store": "phoneNumber",
      "storeOmit": false
    },
    {
      "go": "Role",
      "type": "UserRole",
      "name": "role",
      "omit": false,
      "store": "role",
      "storeOmit": false
    },
    {
      "go": "RentedPropertyID",
      "type": "string",
      "name": "rentedPropertyId",
      "omit": true,
      "store": "rentedPropertyId",
      "storeOmit": true
    },
    {
      "go": "RentedPropertyOwnerID",
      "type": "string",
      "name": "rentedPropertyOwnerId",
      "omit": true,
      "store": "rentedPropertyOwnerId",
      "storeOmit": true
    },
    {
      "go": "RentedPropertyOwnerName",
      "type": "string",
      "name": "rentedPropertyOwnerName",
      "omit": true,
      "store": "rentedPropertyOwnerName",
      "storeOmit": true
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    },
    {
      "go": "IsActive",
      "type": "bool",
      "name": "isActive",
      "omit": false,
      "store": "isActive",
      "storeOmit": false
    }
  ],
  "TenantInfo": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "FirstName",
      "type": "string",
      "name": "firstName",
      "omit": false,
      "store": "firstName",
      "storeOmit": false
    },
    {
      "go": "LastName",
      "type": "string",
      "name": "lastName",
      "omit": false,
      "store": "lastName",
      "storeOmit": false
    },
    {
      "go": "Email",
      "type": "string",
      "name": "email",
      "omit": false,
      "store": "email",
      "storeOmit": false
    },
    {
      "go": "Phone",
      "type": "string",
      "name": "phone",
      "omit": false,
      "store": "phone",
      "storeOmit": false
    },
    {
      "go": "EmergencyContact",
      "type": "string",
      "name": "emergencyContact",
      "omit": false,
      "store": "emergencyContact",
      "storeOmit": false
    },
    {
      "go": "UserUID",
      "type": "string",
      "name": "userUID",
      "omit": true,
      "store": "userUID",
      "storeOmit": true
    },
    {
      "go": "IsMarried",
      "type": "bool",
      "name": "isMarried",
      "omit": false,
      "store": "isMarried",
      "storeOmit": false
    },
    {
      "go": "Spouse",
      "type": "*SpouseInfo",
      "name": "spouse",
      "omit": true,
      "store": "spouse",
      "storeOmit": true
    },
    {
      "go": "LeaseStartDate",
      "type": "string",
      "name": "leaseStartDate",
      "omit": false,
      "store": "leaseStartDate",
      "storeOmit": false
    },
    {
      "go": "LeaseEndDate",
      "type": "string",
      "name": "leaseEndDate",
      "omit": false,
      "store": "leaseEndDate",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent",
      "type": "string",
      "name": "monthlyRent",
      "omit": false,
      "store": "monthlyRent",
      "storeOmit": false
    },
    {
      "go": "SecurityDeposit",
      "type": "string",
      "name": "securityDeposit",
      "omit": false,
      "store": "securityDeposit",
      "storeOmit": false
    },
    {
      "go": "PaymentDueDate",
      "type": "string",
      "name": "paymentDueDate",
      "omit": false,
      "store": "paymentDueDate",
      "storeOmit": false
    },
    {
      "go": "EscalationPercentage",
      "type": "string",
      "name": "escalationPercentage",
      "omit": false,
      "store": "escalationPercentage",
      "storeOmit": false
    },
    {
      "go": "EscalationAmount",
      "type": "string",
      "name": "escalationAmount",
      "omit": false,
      "store": "escalationAmount",
      "storeOmit": false
    },
    {
      "go": "PreviousAddress",
      "type": "string",
      "name": "previousAddress",
      "omit": false,
      "store": "previousAddress",
      "storeOmit": false
    },
    {
      "go": "EmploymentStatus",
      "type": "string",
      "name": "employmentStatus",
      "omit": false,
      "store": "employmentStatus",
      "storeOmit": false
    },
    {
      "go": "Employer",
      "type": "string",
      "name": "employer",
      "omit": false,
      "store": "employer",
      "storeOmit": false
    },
    {
      "go": "MonthlyIncome",
      "type": "string",
      "name": "monthlyIncome",
      "omit": false,
      "store": "monthlyIncome",
      "storeOmit": false
    },
    {
      "go": "Notes",
      "type": "string",
      "name": "notes",
      "omit": false,
      "store": "notes",
      "storeOmit": false
    },
    {
      "go": "IsActive",
      "type": "bool",
      "name": "isActive",
      "omit": false,
      "store": "isActive",
      "storeOmit": false
    },
    {
      "go": "NoticePeriod",
      "type": "string",
      "name": "noticePeriod",
      "omit": false,
      "store": "noticePeriod",
      "storeOmit": false
    },
    {
      "go": "LastRentPaymentReminderSentAt",
      "type": "interface{}",
      "name": "lastRentPaymentReminderSentAt",
      "omit": true,
      "store": "lastRentPaymentReminderSentAt",
      "storeOmit": true
    },
    {
      "go": "LastNoticePeriodReminderSentAt",
      "type": "interface{}",
      "name": "lastNoticePeriodReminderSentAt",
      "omit": true,
      "store": "lastNoticePeriodReminderSentAt",
      "storeOmit": true
    },
    {
      "go": "RentSchedule",
      "type": "[]RentScheduleItem",
      "name": "rentSchedule",
      "omit": false,
      "store": "rentSchedule",
      "storeOmit": false
    },
    {
      "go": "CreatedAt",
      "type": "interface{}",
      "name": "createdAt",
      "omit": true,
      "store": "createdAt",
      "storeOmit": true
    },
    {
      "go": "UpdatedAt",
      "type": "interface{}",
      "name": "updatedAt",
      "omit": true,
      "store": "updatedAt",
      "storeOmit": true
    }
  ],
  "BuyerInfo": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "FirstName",
      "type": "string",
      "name": "firstName",
      "omit": false,
      "store": "firstName",
      "storeOmit": false
    },
    {
      "go": "LastName",
      "type": "string",
      "name": "lastName",
      "omit": false,
      "store": "lastName",
      "storeOmit": false
    },
    {
      "go": "Email",
      "type": "string",
      "name": "email",
      "omit": false,
      "store": "email",
      "storeOmit": false
    },
    {
      "go": "Phone",
      "type": "string",
      "name": "phone",
      "omit": false,
      "store": "phone",
      "storeOmit": false
    },
    {
      "go": "EmergencyContact",
      "type": "string",
      "name": "emergencyContact",
      "omit": false,
      "store": "emergencyContact",
      "storeOmit": false
    },
    {
      "go": "OfferAmount",
      "type": "string",
      "name": "offerAmount",
      "omit": false,
      "store": "offerAmount",
      "storeOmit": false
    },
    {
      "go": "FinancingType",
      "type": "string",
      "name": "financingType",
      "omit": false,
      "store": "financingType",
      "storeOmit": false
    },
    {
      "go": "PreApprovalAmount",
      "type": "string",
      "name": "preApprovalAmount",
      "omit": false,
      "store": "preApprovalAmount",
      "storeOmit": false
    },
    {
      "go": "ClosingDate",
      "type": "string",
      "name": "closingDate",
      "omit": false,
      "store": "closingDate",
      "storeOmit": false
    },
    {
      "go": "CurrentAddress",
      "type": "string",
      "name": "currentAddress",
      "omit": false,
      "store": "currentAddress",
      "storeOmit": false
    },
    {
      "go": "EmploymentStatus",
      "type": "string",
      "name": "employmentStatus",
      "omit": false,
      "store": "employmentStatus",
      "storeOmit": false
    },
    {
      "go": "Employer",
      "type": "string",
      "name": "employer",
      "omit": false,
      "store": "employer",
      "storeOmit": false
    },
    {
      "go": "AnnualIncome",
      "type": "string",
      "name": "annualIncome",
      "omit": false,
      "store": "annualIncome",
      "storeOmit": false
    },
    {
      "go": "AgentName",
      "type": "string",
      "name": "agentName",
      "omit": false,
      "store": "agentName",
      "storeOmit": false
    },
    {
      "go": "AgentPhone",
      "type": "string",
      "name": "agentPhone",
      "omit": false,
      "store": "agentPhone",
      "storeOmit": false
    },
    {
      "go": "Notes",
      "type": "string",
      "name": "notes",
      "omit": false,
      "store": "notes",
      "storeOmit": false
    },
    {
      "go": "IsActive",
      "type": "bool",
      "name": "isActive",
      "omit": false,
      "store": "isActive",
      "storeOmit": false
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    }
  ],
  "RentScheduleItem": [
    {
      "go": "Year",
      "type": "string",
      "name": "year",
      "omit": false,
      "store": "year",
      "storeOmit": false
    },
    {
      "go": "Amount",
      "type": "string",
      "name": "amount",
      "omit": false,
      "store": "amount",
      "storeOmit": false
    },
    {
      "go": "FromDate",
      "type": "string",
      "name": "fromDate",
      "omit": false,
      "store": "fromDate",
      "storeOmit": false
    },
    {
      "go": "ToDate",
      "type": "string",
      "name": "toDate",
      "omit": false,
      "store": "toDate",
      "storeOmit": false
    }
  ],
  "SpouseInfo": [
    {
      "go": "FirstName",
      "type": "string",
      "name": "firstName",
      "omit": false,
      "store": "firstName",
      "storeOmit": false
    },
    {
      "go": "LastName",
      "type": "string",
      "name": "lastName",
      "omit": false,
      "store": "lastName",
      "storeOmit": false
    },
    {
      "go": "Email",
      "type": "string",
      "name": "email",
      "omit": false,
      "store": "email",
      "storeOmit": false
    },
    {
      "go": "Phone",
      "type": "string",
      "name": "phone",
      "omit": false,
      "store": "phone",
      "storeOmit": false
    },
    {
      "go": "EmploymentStatus",
      "type": "string",
      "name": "employmentStatus",
      "omit": false,
      "store": "employmentStatus",
      "storeOmit": false
    },
    {
      "go": "Employer",
      "type": "string",
      "name": "employer",
      "omit": false,
      "store": "employer",
      "storeOmit": false
    },
    {
      "go": "Notes",
      "type": "string",
      "name": "notes",
      "omit": false,
      "store": "notes",
      "storeOmit": false
    }
  ],
  "FurnishedItem": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "Name",
      "type": "string",
      "name": "name",
      "omit": false,
      "store": "name",
      "storeOmit": false
    },
    {
      "go": "Checked",
      "type": "bool",
      "name": "checked",
      "omit": false,
      "store": "checked",
      "storeOmit": false
    },
    {
      "go": "Quantity",
      "type": "int",
      "name": "quantity",
      "omit": false,
      "store": "quantity",
      "storeOmit": false
    },
    {
      "go": "Category",
      "type": "string",
      "name": "category",
      "omit": false,
      "store": "category",
      "storeOmit": false
    }
  ],
  "AdminNotification": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "Type",
      "type": "string",
      "name": "type",
      "omit": false,
      "store": "type",
      "storeOmit": false
    },
    {
      "go": "Title",
      "type": "string",
      "name": "title",
      "omit": false,
      "store": "title",
      "storeOmit": false
    },
    {
      "go": "Message",
      "type": "string",
      "name": "message",
      "omit": false,
      "store": "message",
      "storeOmit": false
    },
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "OwnerID",
      "type": "string",
      "name": "ownerId",
      "omit": false,
      "store": "ownerId",
      "storeOmit": false
    },
    {
      "go": "OwnerName",
      "type": "string",
      "name": "ownerName",
      "omit": false,
      "store": "ownerName",
      "storeOmit": false
    },
    {
      "go": "OwnerPhone",
      "type": "string",
      "name": "ownerPhone",
      "omit": true,
      "store": "ownerPhone",
      "storeOmit": true
    },
    {
      "go": "OwnerEmail",
      "type": "string",
      "name": "ownerEmail",
      "omit": true,
      "store": "ownerEmail",
      "storeOmit": true
    },
    {
      "go": "OwnerRole",
      "type": "string",
      "name": "ownerRole",
      "omit": true,
      "store": "ownerRole",
      "storeOmit": true
    },
    {
      "go": "UserID",
      "type": "string",
      "name": "userId",
      "omit": true,
      "store": "userId",
      "storeOmit": true
    },
    {
      "go": "UserName",
      "type": "string",
      "name": "userName",
      "omit": true,
      "store": "userName",
      "storeOmit": true
    },
    {
      "go": "UserEmail",
      "type": "string",
      "name": "userEmail",
      "omit": true,
      "store": "userEmail",
      "storeOmit": true
    },
    {
      "go": "UserPhone",
      "type": "string",
      "name": "userPhone",
      "omit": true,
      "store": "userPhone",
      "storeOmit": true
    },
    {
      "go": "TenantName",
      "type": "string",
      "name": "tenantName",
      "omit": true,
      "store": "tenantName",
      "storeOmit": true
    },
    {
      "go": "TenantPhone",
      "type": "string",
      "name": "tenantPhone",
      "omit": true,
      "store": "tenantPhone",
      "storeOmit": true
    },
    {
      "go": "TenantEmail",
      "type": "string",
      "name": "tenantEmail",
      "omit": true,
      "store": "tenantEmail",
      "storeOmit": true
    },
    {
      "go": "Buyers",
      "type": "string",
      "name": "buyers",
      "omit": true,
      "store": "buyers",
      "storeOmit": true
    },
    {
      "go": "PropertyTitle",
      "type": "string",
      "name": "propertyTitle",
      "omit": true,
      "store": "propertyTitle",
      "storeOmit": true
    },
    {
      "go": "PropertyAddress",
      "type": "string",
      "name": "propertyAddress",
      "omit": true,
      "store": "propertyAddress",
      "storeOmit": true
    },
    {
      "go": "PropertyListingType",
      "type": "string",
      "name": "propertyListingType",
      "omit": true,
      "store": "propertyListingType",
      "storeOmit": true
    },
    {
      "go": "ServiceType",
      "type": "string",
      "name": "serviceType",
      "omit": true,
      "store": "serviceType",
      "storeOmit": true
    },
    {
      "go": "ServiceComment",
      "type": "string",
      "name": "serviceComment",
      "omit": true,
      "store": "serviceComment",
      "storeOmit": true
    },
    {
      "go": "ServiceImage",
      "type": "string",
      "name": "serviceImage",
      "omit": true,
      "store": "serviceImage",
      "storeOmit": true
    },
    {
      "go": "InquiryType",
      "type": "string",
      "name": "inquiryType",
      "omit": true,
      "store": "inquiryType",
      "storeOmit": true
    },
    {
      "go": "PropertyType",
      "type": "string",
      "name": "propertyType",
      "omit": true,
      "store": "propertyType",
      "storeOmit": true
    },
    {
      "go": "RequestVisit",
      "type": "bool",
      "name": "requestVisit",
      "omit": true,
      "store": "requestVisit",
      "storeOmit": true
    },
    {
      "go": "VisitDate",
      "type": "string",
      "name": "visitDate",
      "omit": true,
      "store": "visitDate",
      "storeOmit": true
    },
    {
      "go": "VisitTime",
      "type": "string",
      "name": "visitTime",
      "omit": true,
      "store": "visitTime",
      "storeOmit": true
    },
    {
      "go": "ReviewerType",
      "type": "string",
      "name": "reviewerType",
      "omit": true,
      "store": "reviewerType",
      "storeOmit": true
    },
    {
      "go": "TenantPart",
      "type": "TenantReviewPart",
      "name": "tenantPart",
      "omit": true,
      "store": "tenantPart",
      "storeOmit": true
    },
    {
      "go": "OwnerPart",
      "type": "OwnerReviewPart",
      "name": "ownerPart",
      "omit": true,
      "store": "ownerPart",
      "storeOmit": true
    },
    {
      "go": "Timestamp",
      "type": "time.Time",
      "name": "timestamp",
      "omit": false,
      "store": "timestamp",
      "storeOmit": false
    },
    {
      "go": "IsRead",
      "type": "bool",
      "name": "isRead",
      "omit": false,
      "store": "isRead",
      "storeOmit": false
    },
    {
      "go": "ResolvedAt",
      "type": "*time.Time",
      "name": "resolvedAt",
      "omit": true,
      "store": "resolvedAt",
      "storeOmit": true
    },
    {
      "go": "Priority",
      "type": "string",
      "name": "priority",
      "omit": false,
      "store": "priority",
      "storeOmit": false
    },
    {
      "go": "AdminRemarks",
      "type": "string",
      "name": "adminRemarks",
      "omit": true,
      "store": "adminRemarks",
      "storeOmit": true
    },
    {
      "go": "AdminImage",
      "type": "string",
      "name": "adminImage",
      "omit": true,
      "store": "adminImage",
      "storeOmit": true
    },
    {
      "go": "ArchiveHistory",
      "type": "[]ArchiveHistoryEntry",
      "name": "archiveHistory",
      "omit": true,
      "store": "archiveHistory",
      "storeOmit": true
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    }
  ],
  "TenantReviewPart": [
    {
      "go": "OwnerUnderstandable",
      "type": "string",
      "name": "ownerUnderstandable",
      "omit": false,
      "store": "ownerUnderstandable",
      "storeOmit": false
    },
    {
      "go": "SoftNature",
      "type": "string",
      "name": "softNature",
      "omit": false,
      "store": "softNature",
      "storeOmit": false
    },
    {
      "go": "OwnerTransparent",
      "type": "string",
      "name": "ownerTransparent",
      "omit": false,
      "store": "ownerTransparent",
      "storeOmit": false
    },
    {
      "go": "ProblemSolver",
      "type": "string",
      "name": "problemSolver",
      "omit": false,
      "store": "problemSolver",
      "storeOmit": false
    },
    {
      "go": "EasyOnRefundMoney",
      "type": "string",
      "name": "easyOnRefundMoney",
      "omit": false,
      "store": "easyOnRefundMoney",
      "storeOmit": false
    },
    {
      "go": "OverallExperience",
      "type": "string",
      "name": "overallExperience",
      "omit": false,
      "store": "overallExperience",
      "storeOmit": false
    }
  ],
  "OwnerReviewPart": [
    {
      "go": "TenantUnderstandable",
      "type": "string",
      "name": "tenantUnderstandable",
      "omit": false,
      "store": "tenantUnderstandable",
      "storeOmit": false
    },
    {
      "go": "SoftNature",
      "type": "string",
      "name": "softNature",
      "omit": false,
      "store": "softNature",
      "storeOmit": false
    },
    {
      "go": "TenantTransparent",
      "type": "string",
      "name": "tenantTransparent",
      "omit": false,
      "store": "tenantTransparent",
      "storeOmit": false
    },
    {
      "go": "ProblemSolver",
      "type": "string",
      "name": "problemSolver",
      "omit": false,
      "store": "problemSolver",
      "storeOmit": false
    },
    {
      "go": "PunctualOnPayment",
      "type": "string",
      "name": "punctualOnPayment",
      "omit": false,
      "store": "punctualOnPayment",
      "storeOmit": false
    },
    {
      "go": "OverallExperience",
      "type": "string",
      "name": "overallExperience",
      "omit": false,
      "store": "overallExperience",
      "storeOmit": false
    }
  ],
  "ArchiveHistoryEntry": [
    {
      "go": "Action",
      "type": "string",
      "name": "action",
      "omit": false,
      "store": "action",
      "storeOmit": false
    },
    {
      "go": "Timestamp",
      "type": "time.Time",
      "name": "timestamp",
      "omit": false,
      "store": "timestamp",
      "storeOmit": false
    }
  ],
  "CreateAdminNotificationRequest": [
    {
      "go": "Type",
      "type": "string",
      "name": "type",
      "omit": false,
      "store": "type",
      "storeOmit": false
    },
    {
      "go": "Title",
      "type": "string",
      "name": "title",
      "omit": false,
      "store": "title",
      "storeOmit": false
    },
    {
      "go": "Message",
      "type": "string",
      "name": "message",
      "omit": false,
      "store": "message",
      "storeOmit": false
    },
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "OwnerID",
      "type": "string",
      "name": "ownerId",
      "omit": false,
      "store": "ownerId",
      "storeOmit": false
    },
    {
      "go": "OwnerName",
      "type": "string",
      "name": "ownerName",
      "omit": false,
      "store": "ownerName",
      "storeOmit": false
    },
    {
      "go": "OwnerPhone",
      "type": "string",
      "name": "ownerPhone",
      "omit": true,
      "store": "ownerPhone",
      "storeOmit": false
    },
    {
      "go": "OwnerEmail",
      "type": "string",
      "name": "ownerEmail",
      "omit": true,
      "store": "ownerEmail",
      "storeOmit": false
    },
    {
      "go": "OwnerRole",
      "type": "string",
      "name": "ownerRole",
      "omit": true,
      "store": "ownerRole",
      "storeOmit": false
    },
    {
      "go": "UserID",
      "type": "string",
      "name": "userId",
      "omit": true,
      "store": "userId",
      "storeOmit": false
    },
    {
      "go": "UserName",
      "type": "string",
      "name": "userName",
      "omit": true,
      "store": "userName",
      "storeOmit": false
    },
    {
      "go": "UserEmail",
      "type": "string",
      "name": "userEmail",
      "omit": true,
      "store": "userEmail",
      "storeOmit": false
    },
    {
      "go": "UserPhone",
      "type": "string",
      "name": "userPhone",
      "omit": true,
      "store": "userPhone",
      "storeOmit": false
    },
    {
      "go": "TenantName",
      "type": "string",
      "name": "tenantName",
      "omit": true,
      "store": "tenantName",
      "storeOmit": false
    },
    {
      "go": "TenantPhone",
      "type": "string",
      "name": "tenantPhone",
      "omit": true,
      "store": "tenantPhone",
      "storeOmit": false
    },
    {
      "go": "TenantEmail",
      "type": "string",
      "name": "tenantEmail",
      "omit": true,
      "store": "tenantEmail",
      "storeOmit": false
    },
    {
      "go": "Buyers",
      "type": "string",
      "name": "buyers",
      "omit": true,
      "store": "buyers",
      "storeOmit": false
    },
    {
      "go": "PropertyTitle",
      "type": "string",
      "name": "propertyTitle",
      "omit": true,
      "store": "propertyTitle",
      "storeOmit": false
    },
    {
      "go": "PropertyAddress",
      "type": "string",
      "name": "propertyAddress",
      "omit": true,
      "store": "propertyAddress",
      "storeOmit": false
    },
    {
      "go": "PropertyListingType",
      "type": "string",
      "name": "propertyListingType",
      "omit": true,
      "store": "propertyListingType",
      "storeOmit": false
    },
    {
      "go": "ServiceType",
      "type": "string",
      "name": "serviceType",
      "omit": true,
      "store": "serviceType",
      "storeOmit": false
    },
    {
      "go": "ServiceComment",
      "type": "string",
      "name": "serviceComment",
      "omit": true,
      "store": "serviceComment",
      "storeOmit": false
    },
    {
      "go": "ServiceImage",
      "type": "string",
      "name": "serviceImage",
      "omit": true,
      "store": "serviceImage",
      "storeOmit": false
    },
    {
      "go": "InquiryType",
      "type": "string",
      "name": "inquiryType",
      "omit": true,
      "store": "inquiryType",
      "storeOmit": false
    },
    {
      "go": "PropertyType",
      "type": "string",
      "name": "propertyType",
      "omit": true,
      "store": "propertyType",
      "storeOmit": false
    },
    {
      "go": "RequestVisit",
      "type": "bool",
      "name": "requestVisit",
      "omit": true,
      "store": "requestVisit",
      "storeOmit": false
    },
    {
      "go": "VisitDate",
      "type": "string",
      "name": "visitDate",
      "omit": true,
      "store": "visitDate",
      "storeOmit": false
    },
    {
      "go": "VisitTime",
      "type": "string",
      "name": "visitTime",
      "omit": true,
      "store": "visitTime",
      "storeOmit": false
    },
    {
      "go": "ReviewerType",
      "type": "string",
      "name": "reviewerType",
      "omit": true,
      "store": "reviewerType",
      "storeOmit": false
    },
    {
      "go": "TenantPart",
      "type": "TenantReviewPart",
      "name": "tenantPart",
      "omit": true,
      "store": "tenantPart",
      "storeOmit": false
    },
    {
      "go": "OwnerPart",
      "type": "OwnerReviewPart",
      "name": "ownerPart",
      "omit": true,
      "store": "ownerPart",
      "storeOmit": false
    },
    {
      "go": "Timestamp",
      "type": "string",
      "name": "timestamp",
      "omit": false,
      "store": "timestamp",
      "storeOmit": false
    },
    {
      "go": "IsRead",
      "type": "bool",
      "name": "isRead",
      "omit": false,
      "store": "isRead",
      "storeOmit": false
    },
    {
      "go": "Priority",
      "type": "string",
      "name": "priority",
      "omit": false,
      "store": "priority",
      "storeOmit": false
    },
    {
      "go": "AdminRemarks",
      "type": "string",
      "name": "adminRemarks",
      "omit": true,
      "store": "adminRemarks",
      "storeOmit": false
    }
  ],
  "Visit": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "UserID",
      "type": "string",
      "name": "userId",
      "omit": false,
      "store": "userId",
      "storeOmit": false
    },
    {
      "go": "Title",
      "type": "string",
      "name": "title",
      "omit": false,
      "store": "title",
      "storeOmit": false
    },
    {
      "go": "Description",
      "type": "string",
      "name": "description",
      "omit": false,
      "store": "description",
      "storeOmit": false
    },
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": true,
      "store": "propertyId",
      "storeOmit": true
    },
    {
      "go": "VisitDate",
      "type": "time.Time",
      "name": "visitDate",
      "omit": false,
      "store": "visitDate",
      "storeOmit": false
    },
    {
      "go": "ReminderType",
      "type": "string",
      "name": "reminderType",
      "omit": false,
      "store": "reminderType",
      "storeOmit": false
    },
    {
      "go": "ReminderTime",
      "type": "int",
      "name": "reminderTime",
      "omit": false,
      "store": "reminderTime",
      "storeOmit": false
    },
    {
      "go": "Status",
      "type": "string",
      "name": "status",
      "omit": false,
      "store": "status",
      "storeOmit": false
    },
    {
      "go": "IsCompleted",
      "type": "bool",
      "name": "isCompleted",
      "omit": false,
      "store": "isCompleted",
      "storeOmit": false
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    },
    {
      "go": "NotifiedAt",
      "type": "time.Time",
      "name": "notifiedAt",
      "omit": true,
      "store": "notifiedAt",
      "storeOmit": true
    }
  ],
  "CreateVisitRequest": [
    {
      "go": "Title",
      "type": "string",
      "name": "title",
      "omit": false,
      "store": "title",
      "storeOmit": false
    },
    {
      "go": "Description",
      "type": "string",
      "name": "description",
      "omit": true,
      "store": "description",
      "storeOmit": false
    },
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": true,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "VisitDate",
      "type": "string",
      "name": "visitDate",
      "omit": false,
      "store": "visitDate",
      "storeOmit": false
    },
    {
      "go": "ReminderType",
      "type": "string",
      "name": "reminderType",
      "omit": false,
      "store": "reminderType",
      "storeOmit": false
    },
    {
      "go": "ReminderTime",
      "type": "int",
      "name": "reminderTime",
      "omit": false,
      "store": "reminderTime",
      "storeOmit": false
    }
  ],
  "UpdateVisitRequest": [
    {
      "go": "Title",
      "type": "string",
      "name": "title",
      "omit": true,
      "store": "title",
      "storeOmit": false
    },
    {
      "go": "Description",
      "type": "string",
      "name": "description",
      "omit": true,
      "store": "description",
      "storeOmit": false
    },
    {
      "go": "VisitDate",
      "type": "string",
      "name": "visitDate",
      "omit": true,
      "store": "visitDate",
      "storeOmit": false
    },
    {
      "go": "ReminderType",
      "type": "string",
      "name": "reminderType",
      "omit": true,
      "store": "reminderType",
      "storeOmit": false
    },
    {
      "go": "ReminderTime",
      "type": "int",
      "name": "reminderTime",
      "omit": true,
      "store": "reminderTime",
      "storeOmit": false
    },
    {
      "go": "Status",
      "type": "string",
      "name": "status",
      "omit": true,
      "store": "status",
      "storeOmit": false
    },
    {
      "go": "IsCompleted",
      "type": "bool",
      "name": "isCompleted",
      "omit": true,
      "store": "isCompleted",
      "storeOmit": false
    }
  ],
  "Tenant": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "OwnerUID",
      "type": "string",
      "name": "ownerUID",
      "omit": false,
      "store": "ownerUID",
      "storeOmit": false
    },
    {
      "go": "FirstName",
      "type": "string",
      "name": "firstName",
      "omit": false,
      "store": "firstName",
      "storeOmit": false
    },
    {
      "go": "LastName",
      "type": "string",
      "name": "lastName",
      "omit": false,
      "store": "lastName",
      "storeOmit": false
    },
    {
      "go": "Email",
      "type": "string",
      "name": "email",
      "omit": false,
      "store": "email",
      "storeOmit": false
    },
    {
      "go": "Phone",
      "type": "string",
      "name": "phone",
      "omit": false,
      "store": "phone",
      "storeOmit": false
    },
    {
      "go": "EmergencyContact",
      "type": "string",
      "name": "emergencyContact",
      "omit": false,
      "store": "emergencyContact",
      "storeOmit": false
    },
    {
      "go": "UserUID",
      "type": "string",
      "name": "userUID",
      "omit": true,
      "store": "userUID",
      "storeOmit": true
    },
    {
      "go": "IsMarried",
      "type": "bool",
      "name": "isMarried",
      "omit": false,
      "store": "isMarried",
      "storeOmit": false
    },
    {
      "go": "Spouse",
      "type": "*SpouseInfo",
      "name": "spouse",
      "omit": true,
      "store": "spouse",
      "storeOmit": true
    },
    {
      "go": "LeaseStartDate",
      "type": "string",
      "name": "leaseStartDate",
      "omit": false,
      "store": "leaseStartDate",
      "storeOmit": false
    },
    {
      "go": "LeaseEndDate",
      "type": "string",
      "name": "leaseEndDate",
      "omit": false,
      "store": "leaseEndDate",
      "storeOmit": false
    },
    {
      "go": "MonthlyRent",
      "type": "string",
      "name": "monthlyRent",
      "omit": false,
      "store": "monthlyRent",
      "storeOmit": false
    },
    {
      "go": "SecurityDeposit",
      "type": "string",
      "name": "securityDeposit",
      "omit": false,
      "store": "securityDeposit",
      "storeOmit": false
    },
    {
      "go": "NoticePeriod",
      "type": "string",
      "name": "noticePeriod",
      "omit": false,
      "store": "noticePeriod",
      "storeOmit": false
    },
    {
      "go": "PaymentDueDate",
      "type": "string",
      "name": "paymentDueDate",
      "omit": false,
      "store": "paymentDueDate",
      "storeOmit": false
    },
    {
      "go": "EscalationPercentage",
      "type": "string",
      "name": "escalationPercentage",
      "omit": false,
      "store": "escalationPercentage",
      "storeOmit": false
    },
    {
      "go": "EscalationAmount",
      "type": "string",
      "name": "escalationAmount",
      "omit": false,
      "store": "escalationAmount",
      "storeOmit": false
    },
    {
      "go": "PreviousAddress",
      "type": "string",
      "name": "previousAddress",
      "omit": false,
      "store": "previousAddress",
      "storeOmit": false
    },
    {
      "go": "EmploymentStatus",
      "type": "string",
      "name": "employmentStatus",
      "omit": false,
      "store": "employmentStatus",
      "storeOmit": false
    },
    {
      "go": "Employer",
      "type": "string",
      "name": "employer",
      "omit": false,
      "store": "employer",
      "storeOmit": false
    },
    {
      "go": "MonthlyIncome",
      "type": "string",
      "name": "monthlyIncome",
      "omit": false,
      "store": "monthlyIncome",
      "storeOmit": false
    },
    {
      "go": "Notes",
      "type": "string",
      "name": "notes",
      "omit": false,
      "store": "notes",
      "storeOmit": false
    },
    {
      "go": "IsActive",
      "type": "bool",
      "name": "isActive",
      "omit": false,
      "store": "isActive",
      "storeOmit": false
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    }
  ],
  "CreateTenantRequest": [
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "OwnerUID",
      "type": "string",
      "name": "ownerUID",
      "omit": false,
      "store": "ownerUID",
      "storeOmit": false
    },
    {
      "go": "Tenants",
      "type": "[]Tenant",
      "name": "tenants",
      "omit": false,
      "store": "tenants",
      "storeOmit": false
    }
  ],
  "Document": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "PropertyTitle",
      "type": "string",
      "name": "propertyTitle",
      "omit": false,
      "store": "propertyTitle",
      "storeOmit": false
    },
    {
      "go": "UserID",
      "type": "string",
      "name": "userId",
      "omit": false,
      "store": "userId",
      "storeOmit": false
    },
    {
      "go": "UserName",
      "type": "string",
      "name": "userName",
      "omit": false,
      "store": "userName",
      "storeOmit": false
    },
    {
      "go": "DocumentName",
      "type": "string",
      "name": "documentName",
      "omit": false,
      "store": "documentName",
      "storeOmit": false
    },
    {
      "go": "DocumentType",
      "type": "string",
      "name": "documentType",
      "omit": false,
      "store": "documentType",
      "storeOmit": false
    },
    {
      "go": "FileURL",
      "type": "string",
      "name": "fileUrl",
      "omit": false,
      "store": "fileUrl",
      "storeOmit": false
    },
    {
      "go": "Description",
      "type": "string",
      "name": "description",
      "omit": true,
      "store": "description",
      "storeOmit": true
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    }
  ],
  "CreateDocumentRequest": [
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "DocumentName",
      "type": "string",
      "name": "documentName",
      "omit": false,
      "store": "documentName",
      "storeOmit": false
    },
    {
      "go": "DocumentType",
      "type": "string",
      "name": "documentType",
      "omit": false,
      "store": "documentType",
      "storeOmit": false
    },
    {
      "go": "FileURL",
      "type": "string",
      "name": "fileUrl",
      "omit": false,
      "store": "fileUrl",
      "storeOmit": false
    },
    {
      "go": "Description",
      "type": "string",
      "name": "description",
      "omit": true,
      "store": "description",
      "storeOmit": false
    }
  ],
  "Review": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "PropertyTitle",
      "type": "string",
      "name": "propertyTitle",
      "omit": false,
      "store": "propertyTitle",
      "storeOmit": false
    },
    {
      "go": "ReviewerID",
      "type": "string",
      "name": "reviewerId",
      "omit": false,
      "store": "reviewerId",
      "storeOmit": false
    },
    {
      "go": "ReviewerName",
      "type": "string",
      "name": "reviewerName",
      "omit": false,
      "store": "reviewerName",
      "storeOmit": false
    },
    {
      "go": "ReviewerEmail",
      "type": "string",
      "name": "reviewerEmail",
      "omit": false,
      "store": "reviewerEmail",
      "storeOmit": false
    },
    {
      "go": "ReviewerPhone",
      "type": "string",
      "name": "reviewerPhone",
      "omit": false,
      "store": "reviewerPhone",
      "storeOmit": false
    },
    {
      "go": "ReviewerType",
      "type": "string",
      "name": "reviewerType",
      "omit": false,
      "store": "reviewerType",
      "storeOmit": false
    },
    {
      "go": "OwnerID",
      "type": "string",
      "name": "ownerId",
      "omit": false,
      "store": "ownerId",
      "storeOmit": false
    },
    {
      "go": "OwnerName",
      "type": "string",
      "name": "ownerName",
      "omit": false,
      "store": "ownerName",
      "storeOmit": false
    },
    {
      "go": "OwnerEmail",
      "type": "string",
      "name": "ownerEmail",
      "omit": false,
      "store": "ownerEmail",
      "storeOmit": false
    },
    {
      "go": "OwnerPhone",
      "type": "string",
      "name": "ownerPhone",
      "omit": false,
      "store": "ownerPhone",
      "storeOmit": false
    },
    {
      "go": "TenantID",
      "type": "string",
      "name": "tenantId",
      "omit": true,
      "store": "tenantId",
      "storeOmit": true
    },
    {
      "go": "TenantName",
      "type": "string",
      "name": "tenantName",
      "omit": true,
      "store": "tenantName",
      "storeOmit": true
    },
    {
      "go": "TenantPart",
      "type": "TenantReviewPart",
      "name": "tenantPart",
      "omit": false,
      "store": "tenantPart",
      "storeOmit": false
    },
    {
      "go": "OwnerPart",
      "type": "OwnerReviewPart",
      "name": "ownerPart",
      "omit": false,
      "store": "ownerPart",
      "storeOmit": false
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    }
  ],
  "CreateReviewRequest": [
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "ReviewerType",
      "type": "string",
      "name": "reviewerType",
      "omit": false,
      "store": "reviewerType",
      "storeOmit": false
    },
    {
      "go": "TenantPart",
      "type": "TenantReviewPart",
      "name": "tenantPart",
      "omit": false,
      "store": "tenantPart",
      "storeOmit": false
    },
    {
      "go": "OwnerPart",
      "type": "OwnerReviewPart",
      "name": "ownerPart",
      "omit": false,
      "store": "ownerPart",
      "storeOmit": false
    }
  ],
  "InspectionReport": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "PropertyTitle",
      "type": "string",
      "name": "propertyTitle",
      "omit": false,
      "store": "propertyTitle",
      "storeOmit": false
    },
    {
      "go": "UserID",
      "type": "string",
      "name": "userId",
      "omit": false,
      "store": "userId",
      "storeOmit": false
    },
    {
      "go": "UserName",
      "type": "string",
      "name": "userName",
      "omit": false,
      "store": "userName",
      "storeOmit": false
    },
    {
      "go": "UserEmail",
      "type": "string",
      "name": "userEmail",
      "omit": false,
      "store": "userEmail",
      "storeOmit": false
    },
    {
      "go": "UserPhone",
      "type": "string",
      "name": "userPhone",
      "omit": false,
      "store": "userPhone",
      "storeOmit": false
    },
    {
      "go": "ReportType",
      "type": "string",
      "name": "reportType",
      "omit": false,
      "store": "reportType",
      "storeOmit": false
    },
    {
      "go": "Report",
      "type": "string",
      "name": "report",
      "omit": false,
      "store": "report",
      "storeOmit": false
    },
    {
      "go": "PossessionLetterFile",
      "type": "string",
      "name": "possessionLetterFile",
      "omit": true,
      "store": "possessionLetterFile",
      "storeOmit": true
    },
    {
      "go": "HandoverLetterFile",
      "type": "string",
      "name": "handoverLetterFile",
      "omit": true,
      "store": "handoverLetterFile",
      "storeOmit": true
    },
    {
      "go": "KeysDetails",
      "type": "string",
      "name": "keysDetails",
      "omit": true,
      "store": "keysDetails",
      "storeOmit": true
    },
    {
      "go": "ElectricityBillMeterImage",
      "type": "string",
      "name": "electricityBillMeterImage",
      "omit": true,
      "store": "electricityBillMeterImage",
      "storeOmit": true
    },
    {
      "go": "ElectricityBillReceipt",
      "type": "string",
      "name": "electricityBillReceipt",
      "omit": true,
      "store": "electricityBillReceipt",
      "storeOmit": true
    },
    {
      "go": "ApartmentConditionImage",
      "type": "string",
      "name": "apartmentConditionImage",
      "omit": true,
      "store": "apartmentConditionImage",
      "storeOmit": true
    },
    {
      "go": "ApartmentConditionImages",
      "type": "[]string",
      "name": "apartmentConditionImages",
      "omit": true,
      "store": "apartmentConditionImages",
      "storeOmit": true
    },
    {
      "go": "MGLBillMeterImage",
      "type": "string",
      "name": "mglBillMeterImage",
      "omit": true,
      "store": "mglBillMeterImage",
      "storeOmit": true
    },
    {
      "go": "MGLBillReceipt",
      "type": "string",
      "name": "mglBillReceipt",
      "omit": true,
      "store": "mglBillReceipt",
      "storeOmit": true
    },
    {
      "go": "InternetImage",
      "type": "string",
      "name": "internetImage",
      "omit": true,
      "store": "internetImage",
      "storeOmit": true
    },
    {
      "go": "InternetReceipt",
      "type": "string",
      "name": "internetReceipt",
      "omit": true,
      "store": "internetReceipt",
      "storeOmit": true
    },
    {
      "go": "OtherDetails",
      "type": "string",
      "name": "otherDetails",
      "omit": true,
      "store": "otherDetails",
      "storeOmit": true
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    }
  ],
  "CreateInspectionReportRequest": [
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": false,
      "store": "propertyId",
      "storeOmit": false
    },
    {
      "go": "ReportType",
      "type": "string",
      "name": "reportType",
      "omit": false,
      "store": "reportType",
      "storeOmit": false
    },
    {
      "go": "Report",
      "type": "string",
      "name": "report",
      "omit": false,
      "store": "report",
      "storeOmit": false
    },
    {
      "go": "PossessionLetterFile",
      "type": "string",
      "name": "possessionLetterFile",
      "omit": true,
      "store": "possessionLetterFile",
      "storeOmit": false
    },
    {
      "go": "HandoverLetterFile",
      "type": "string",
      "name": "handoverLetterFile",
      "omit": true,
      "store": "handoverLetterFile",
      "storeOmit": false
    },
    {
      "go": "KeysDetails",
      "type": "string",
      "name": "keysDetails",
      "omit": true,
      "store": "keysDetails",
      "storeOmit": false
    },
    {
      "go": "ElectricityBillMeterImage",
      "type": "string",
      "name": "electricityBillMeterImage",
      "omit": true,
      "store": "electricityBillMeterImage",
      "storeOmit": false
    },
    {
      "go": "ElectricityBillReceipt",
      "type": "string",
      "name": "electricityBillReceipt",
      "omit": true,
      "store": "electricityBillReceipt",
      "storeOmit": false
    },
    {
      "go": "ApartmentConditionImage",
      "type": "string",
      "name": "apartmentConditionImage",
      "omit": true,
      "store": "apartmentConditionImage",
      "storeOmit": false
    },
    {
      "go": "ApartmentConditionImages",
      "type": "[]string",
      "name": "apartmentConditionImages",
      "omit": true,
      "store": "apartmentConditionImages",
      "storeOmit": false
    },
    {
      "go": "MGLBillMeterImage",
      "type": "string",
      "name": "mglBillMeterImage",
      "omit": true,
      "store": "mglBillMeterImage",
      "storeOmit": false
    },
    {
      "go": "MGLBillReceipt",
      "type": "string",
      "name": "mglBillReceipt",
      "omit": true,
      "store": "mglBillReceipt",
      "storeOmit": false
    },
    {
      "go": "InternetImage",
      "type": "string",
      "name": "internetImage",
      "omit": true,
      "store": "internetImage",
      "storeOmit": false
    },
    {
      "go": "InternetReceipt",
      "type": "string",
      "name": "internetReceipt",
      "omit": true,
      "store": "internetReceipt",
      "storeOmit": false
    },
    {
      "go": "OtherDetails",
      "type": "string",
      "name": "otherDetails",
      "omit": true,
      "store": "otherDetails",
      "storeOmit": false
    }
  ],
  "Service": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "Name",
      "type": "string",
      "name": "name",
      "omit": false,
      "store": "name",
      "storeOmit": false
    },
    {
      "go": "Description",
      "type": "string",
      "name": "description",
      "omit": false,
      "store": "description",
      "storeOmit": false
    },
    {
      "go": "Category",
      "type": "ServiceCategory",
      "name": "category",
      "omit": false,
      "store": "category",
      "storeOmit": false
    },
    {
      "go": "Code",
      "type": "string",
      "name": "code",
      "omit": false,
      "store": "code",
      "storeOmit": false
    },
    {
      "go": "IsActive",
      "type": "bool",
      "name": "isActive",
      "omit": false,
      "store": "isActive",
      "storeOmit": false
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    }
  ],
  "ServiceRequest": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "UserUID",
      "type": "string",
      "name": "userUID",
      "omit": false,
      "store": "userUID",
      "storeOmit": false
    },
    {
      "go": "UserName",
      "type": "string",
      "name": "userName",
      "omit": false,
      "store": "userName",
      "storeOmit": false
    },
    {
      "go": "UserEmail",
      "type": "string",
      "name": "userEmail",
      "omit": false,
      "store": "userEmail",
      "storeOmit": false
    },
    {
      "go": "UserPhone",
      "type": "string",
      "name": "userPhone",
      "omit": false,
      "store": "userPhone",
      "storeOmit": false
    },
    {
      "go": "ServiceID",
      "type": "string",
      "name": "serviceId",
      "omit": false,
      "store": "serviceId",
      "storeOmit": false
    },
    {
      "go": "ServiceName",
      "type": "string",
      "name": "serviceName",
      "omit": false,
      "store": "serviceName",
      "storeOmit": false
    },
    {
      "go": "PropertyID",
      "type": "string",
      "name": "propertyId",
      "omit": true,
      "store": "propertyId",
      "storeOmit": true
    },
    {
      "go": "Message",
      "type": "string",
      "name": "message",
      "omit": false,
      "store": "message",
      "storeOmit": false
    },
    {
      "go": "Image",
      "type": "string",
      "name": "image",
      "omit": true,
      "store": "image",
      "storeOmit": true
    },
    {
      "go": "Status",
      "type": "ServiceStatus",
      "name": "status",
      "omit": false,
      "store": "status",
      "storeOmit": false
    },
    {
      "go": "AdminNotes",
      "type": "string",
      "name": "adminNotes",
      "omit": true,
      "store": "adminNotes",
      "storeOmit": true
    },
    {
      "go": "CreatedAt",
      "type": "time.Time",
      "name": "createdAt",
      "omit": false,
      "store": "createdAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    }
  ],
  "SiteSettings": [
    {
      "go": "ID",
      "type": "string",
      "name": "id",
      "omit": false,
      "store": "id",
      "storeOmit": false
    },
    {
      "go": "Quote",
      "type": "string",
      "name": "quote",
      "omit": false,
      "store": "quote",
      "storeOmit": false
    },
    {
      "go": "QuoteAuthor",
      "type": "string",
      "name": "quoteAuthor",
      "omit": true,
      "store": "quoteAuthor",
      "storeOmit": true
    },
    {
      "go": "HeroTitle",
      "type": "string",
      "name": "heroTitle",
      "omit": true,
      "store": "heroTitle",
      "storeOmit": true
    },
    {
      "go": "HeroSubtitle",
      "type": "string",
      "name": "heroSubtitle",
      "omit": true,
      "store": "heroSubtitle",
      "storeOmit": true
    },
    {
      "go": "AnnouncementText",
      "type": "string",
      "name": "announcementText",
      "omit": true,
      "store": "announcementText",
      "storeOmit": true
    },
    {
      "go": "IsAnnouncementActive",
      "type": "bool",
      "name": "isAnnouncementActive",
      "omit": false,
      "store": "isAnnouncementActive",
      "storeOmit": false
    },
    {
      "go": "BannerImages",
      "type": "[]string",
      "name": "bannerImages",
      "omit": true,
      "store": "bannerImages",
      "storeOmit": true
    },
    {
      "go": "UpdatedAt",
      "type": "time.Time",
      "name": "updatedAt",
      "omit": false,
      "store": "updatedAt",
      "storeOmit": false
    },
    {
      "go": "UpdatedBy",
      "type": "string",
      "name": "updatedBy",
      "omit": true,
      "store": "updatedBy",
      "storeOmit": true
    }
  ]
};
export const projections: Record<string, string[][]> = {
  "create": [
    [
      "id",
      "id"
    ],
    [
      "title",
      "title"
    ],
    [
      "description",
      "description"
    ],
    [
      "price",
      "price"
    ],
    [
      "address",
      "address"
    ],
    [
      "city",
      "city"
    ],
    [
      "state",
      "state"
    ],
    [
      "zipCode",
      "zipCode"
    ],
    [
      "propertyType",
      "propertyType"
    ],
    [
      "listingType",
      "listingType"
    ],
    [
      "configuration",
      "configuration"
    ],
    [
      "unitNumber",
      "unitNumber"
    ],
    [
      "floor",
      "floor"
    ],
    [
      "location",
      "location"
    ],
    [
      "carpetArea",
      "carpetArea"
    ],
    [
      "constructedArea",
      "constructedArea"
    ],
    [
      "squareFeet",
      "squareFeet"
    ],
    [
      "tenantName",
      "tenantName"
    ],
    [
      "personName",
      "personName"
    ],
    [
      "mobileNumber",
      "mobileNumber"
    ],
    [
      "primaryNo",
      "primaryNo"
    ],
    [
      "ultNo",
      "ultNo"
    ],
    [
      "monthlyRent",
      "monthlyRent"
    ],
    [
      "sellingPrice",
      "sellingPrice"
    ],
    [
      "monthlyRent1stYear",
      "monthlyRent1stYear"
    ],
    [
      "monthlyRent2ndYear",
      "monthlyRent2ndYear"
    ],
    [
      "monthlyRent3rdYear",
      "monthlyRent3rdYear"
    ],
    [
      "monthlyRent4thYear",
      "monthlyRent4thYear"
    ],
    [
      "rentFromDate1",
      "rentFromDate1"
    ],
    [
      "rentToDate1",
      "rentToDate1"
    ],
    [
      "rentFromDate2",
      "rentFromDate2"
    ],
    [
      "rentToDate2",
      "rentToDate2"
    ],
    [
      "paymentDueDate",
      "paymentDueDate"
    ],
    [
      "escalationPercentage",
      "escalationPercentage"
    ],
    [
      "escalationAmount",
      "escalationAmount"
    ],
    [
      "securityDeposit",
      "securityDeposit"
    ],
    [
      "agreementPeriod",
      "agreementPeriod"
    ],
    [
      "agreementStartDate",
      "agreementStartDate"
    ],
    [
      "agreementEndDate",
      "agreementEndDate"
    ],
    [
      "noticePeriod",
      "noticePeriod"
    ],
    [
      "lockInPeriod",
      "lockInPeriod"
    ],
    [
      "unitCondition",
      "unitCondition"
    ],
    [
      "maintenanceToBePaidBy",
      "maintenanceToBePaidBy"
    ],
    [
      "projectCondition",
      "projectCondition"
    ],
    [
      "possessionDate",
      "possessionDate"
    ],
    [
      "rentalStatus",
      "rentalStatus"
    ],
    [
      "furnishedChecklist",
      "furnishedChecklist"
    ],
    [
      "images",
      "images"
    ],
    [
      "specificComments",
      "specificComments"
    ],
    [
      "tenants",
      "tenants"
    ],
    [
      "buyers",
      "buyers"
    ],
    [
      "ownerUID",
      "ownerUID"
    ],
    [
      "ownerName",
      "ownerName"
    ],
    [
      "ownerEmail",
      "ownerEmail"
    ],
    [
      "wantToSell",
      "wantToSell"
    ],
    [
      "status",
      "status"
    ],
    [
      "isActive",
      "isActive"
    ],
    [
      "isSold",
      "isSold"
    ],
    [
      "createdAt",
      "createdAt"
    ],
    [
      "updatedAt",
      "updatedAt"
    ],
    [
      "bedrooms",
      "bedrooms"
    ],
    [
      "bathrooms",
      "bathrooms"
    ]
  ],
  "tenant": [
    [
      "id",
      "id"
    ],
    [
      "title",
      "title"
    ],
    [
      "description",
      "description"
    ],
    [
      "price",
      "price"
    ],
    [
      "address",
      "address"
    ],
    [
      "city",
      "city"
    ],
    [
      "state",
      "state"
    ],
    [
      "zipCode",
      "zipCode"
    ],
    [
      "propertyType",
      "propertyType"
    ],
    [
      "listingType",
      "listingType"
    ],
    [
      "configuration",
      "configuration"
    ],
    [
      "unitNumber",
      "unitNumber"
    ],
    [
      "floor",
      "floor"
    ],
    [
      "location",
      "location"
    ],
    [
      "carpetArea",
      "carpetArea"
    ],
    [
      "constructedArea",
      "constructedArea"
    ],
    [
      "squareFeet",
      "squareFeet"
    ],
    [
      "tenantName",
      "tenantName"
    ],
    [
      "personName",
      "personName"
    ],
    [
      "mobileNumber",
      "mobileNumber"
    ],
    [
      "primaryNo",
      "primaryNo"
    ],
    [
      "ultNo",
      "ultNo"
    ],
    [
      "monthlyRent",
      "monthlyRent"
    ],
    [
      "sellingPrice",
      "sellingPrice"
    ],
    [
      "monthlyRent1stYear",
      "monthlyRent1stYear"
    ],
    [
      "monthlyRent2ndYear",
      "monthlyRent2ndYear"
    ],
    [
      "monthlyRent3rdYear",
      "monthlyRent3rdYear"
    ],
    [
      "monthlyRent4thYear",
      "monthlyRent4thYear"
    ],
    [
      "rentFromDate1",
      "rentFromDate1"
    ],
    [
      "rentToDate1",
      "rentToDate1"
    ],
    [
      "rentFromDate2",
      "rentFromDate2"
    ],
    [
      "rentToDate2",
      "rentToDate2"
    ],
    [
      "paymentDueDate",
      "paymentDueDate"
    ],
    [
      "escalationPercentage",
      "escalationPercentage"
    ],
    [
      "escalationAmount",
      "escalationAmount"
    ],
    [
      "securityDeposit",
      "securityDeposit"
    ],
    [
      "agreementPeriod",
      "agreementPeriod"
    ],
    [
      "agreementStartDate",
      "agreementStartDate"
    ],
    [
      "agreementEndDate",
      "agreementEndDate"
    ],
    [
      "noticePeriod",
      "noticePeriod"
    ],
    [
      "lockInPeriod",
      "lockInPeriod"
    ],
    [
      "unitCondition",
      "unitCondition"
    ],
    [
      "maintenanceToBePaidBy",
      "maintenanceToBePaidBy"
    ],
    [
      "projectCondition",
      "projectCondition"
    ],
    [
      "internalImages",
      "internalImages"
    ],
    [
      "possessionDate",
      "possessionDate"
    ],
    [
      "rentalStatus",
      "rentalStatus"
    ],
    [
      "furnishedChecklist",
      "furnishedChecklist"
    ],
    [
      "images",
      "images"
    ],
    [
      "specificComments",
      "specificComments"
    ],
    [
      "tenants",
      "tenants"
    ],
    [
      "buyers",
      "buyers"
    ],
    [
      "ownerUID",
      "ownerUID"
    ],
    [
      "ownerName",
      "ownerName"
    ],
    [
      "ownerEmail",
      "ownerEmail"
    ],
    [
      "wantToSell",
      "wantToSell"
    ],
    [
      "status",
      "status"
    ],
    [
      "isActive",
      "isActive"
    ],
    [
      "createdAt",
      "createdAt"
    ],
    [
      "updatedAt",
      "updatedAt"
    ],
    [
      "bedrooms",
      "bedrooms"
    ],
    [
      "bathrooms",
      "bathrooms"
    ]
  ],
  "normal": [
    [
      "id",
      "id"
    ],
    [
      "title",
      "title"
    ],
    [
      "description",
      "description"
    ],
    [
      "address",
      "address"
    ],
    [
      "city",
      "city"
    ],
    [
      "state",
      "state"
    ],
    [
      "zipCode",
      "zipCode"
    ],
    [
      "propertyType",
      "propertyType"
    ],
    [
      "listingType",
      "listingType"
    ],
    [
      "configuration",
      "configuration"
    ],
    [
      "unitNumber",
      "unitNumber"
    ],
    [
      "floor",
      "floor"
    ],
    [
      "location",
      "location"
    ],
    [
      "carpetArea",
      "carpetArea"
    ],
    [
      "constructedArea",
      "constructedArea"
    ],
    [
      "squareFeet",
      "squareFeet"
    ],
    [
      "tenantName",
      "tenantName"
    ],
    [
      "personName",
      "personName"
    ],
    [
      "mobileNumber",
      "mobileNumber"
    ],
    [
      "primaryNo",
      "primaryNo"
    ],
    [
      "ultNo",
      "ultNo"
    ],
    [
      "monthlyRent",
      "monthlyRent"
    ],
    [
      "sellingPrice",
      "sellingPrice"
    ],
    [
      "monthlyRent1stYear",
      "monthlyRent1stYear"
    ],
    [
      "monthlyRent2ndYear",
      "monthlyRent2ndYear"
    ],
    [
      "monthlyRent3rdYear",
      "monthlyRent3rdYear"
    ],
    [
      "monthlyRent4thYear",
      "monthlyRent4thYear"
    ],
    [
      "rentFromDate1",
      "rentFromDate1"
    ],
    [
      "rentToDate1",
      "rentToDate1"
    ],
    [
      "rentFromDate2",
      "rentFromDate2"
    ],
    [
      "rentToDate2",
      "rentToDate2"
    ],
    [
      "paymentDueDate",
      "paymentDueDate"
    ],
    [
      "escalationPercentage",
      "escalationPercentage"
    ],
    [
      "escalationAmount",
      "escalationAmount"
    ],
    [
      "securityDeposit",
      "securityDeposit"
    ],
    [
      "agreementPeriod",
      "agreementPeriod"
    ],
    [
      "agreementStartDate",
      "agreementStartDate"
    ],
    [
      "agreementEndDate",
      "agreementEndDate"
    ],
    [
      "noticePeriod",
      "noticePeriod"
    ],
    [
      "lockInPeriod",
      "lockInPeriod"
    ],
    [
      "unitCondition",
      "unitCondition"
    ],
    [
      "maintenanceToBePaidBy",
      "maintenanceToBePaidBy"
    ],
    [
      "projectCondition",
      "projectCondition"
    ],
    [
      "possessionDate",
      "possessionDate"
    ],
    [
      "rentalStatus",
      "rentalStatus"
    ],
    [
      "furnishedChecklist",
      "furnishedChecklist"
    ],
    [
      "images",
      "images"
    ],
    [
      "specificComments",
      "specificComments"
    ],
    [
      "tenants",
      "tenants"
    ],
    [
      "buyers",
      "buyers"
    ],
    [
      "ownerUID",
      "ownerUID"
    ],
    [
      "ownerName",
      "ownerName"
    ],
    [
      "ownerEmail",
      "ownerEmail"
    ],
    [
      "ownerPhone",
      "ownerPhone"
    ],
    [
      "ownerRole",
      "ownerRole"
    ],
    [
      "wantToSell",
      "wantToSell"
    ],
    [
      "status",
      "status"
    ],
    [
      "isActive",
      "isActive"
    ],
    [
      "isSold",
      "isSold"
    ],
    [
      "createdAt",
      "createdAt"
    ],
    [
      "updatedAt",
      "updatedAt"
    ],
    [
      "bedrooms",
      "bedrooms"
    ],
    [
      "bathrooms",
      "bathrooms"
    ],
    [
      "rentSchedule",
      "rentSchedule"
    ],
    [
      "isPreLeased",
      "isPreLeased"
    ],
    [
      "preLeasedType",
      "preLeasedType"
    ],
    [
      "agreementTerm",
      "agreementTerm"
    ],
    [
      "lockInPeriodPreLeased",
      "lockInPeriodPreLeased"
    ],
    [
      "rentalIncome",
      "rentalIncome"
    ],
    [
      "escalation",
      "escalation"
    ],
    [
      "tenantDetails",
      "tenantDetails"
    ],
    [
      "purpose",
      "purpose"
    ],
    [
      "specificRequirement",
      "specificRequirement"
    ]
  ],
  "request": [
    [
      "title",
      "propertyTitle"
    ],
    [
      "propertyType",
      "propertyType"
    ],
    [
      "configuration",
      "configuration"
    ],
    [
      "listingType",
      "listingType"
    ],
    [
      "isSold",
      "isSold"
    ],
    [
      "unitNumber",
      "unitNumber"
    ],
    [
      "floor",
      "floor"
    ],
    [
      "location",
      "location"
    ],
    [
      "address",
      "location"
    ],
    [
      "carpetArea",
      "carpetArea"
    ],
    [
      "constructedArea",
      "constructedArea"
    ],
    [
      "tenantEmail",
      "tenantEmail"
    ],
    [
      "personName",
      "personName"
    ],
    [
      "mobileNumber",
      "mobileNumber"
    ],
    [
      "primaryNo",
      "primaryNo"
    ],
    [
      "ultNo",
      "ultNo"
    ],
    [
      "monthlyRent",
      "monthlyRent"
    ],
    [
      "sellingPrice",
      "sellingPrice"
    ],
    [
      "monthlyRent1stYear",
      "monthlyRent1stYear"
    ],
    [
      "monthlyRent2ndYear",
      "monthlyRent2ndYear"
    ],
    [
      "monthlyRent3rdYear",
      "monthlyRent3rdYear"
    ],
    [
      "monthlyRent4thYear",
      "monthlyRent4thYear"
    ],
    [
      "rentFromDate1",
      "rentFromDate1"
    ],
    [
      "rentToDate1",
      "rentToDate1"
    ],
    [
      "rentFromDate2",
      "rentFromDate2"
    ],
    [
      "rentToDate2",
      "rentToDate2"
    ],
    [
      "paymentDueDate",
      "paymentDueDate"
    ],
    [
      "escalationPercentage",
      "escalationPercentage"
    ],
    [
      "escalationAmount",
      "escalationAmount"
    ],
    [
      "securityDeposit",
      "securityDeposit"
    ],
    [
      "agreementPeriod",
      "agreementPeriod"
    ],
    [
      "agreementStartDate",
      "agreementStartDate"
    ],
    [
      "agreementEndDate",
      "agreementEndDate"
    ],
    [
      "noticePeriod",
      "noticePeriod"
    ],
    [
      "lockInPeriod",
      "lockInPeriod"
    ],
    [
      "unitCondition",
      "unitCondition"
    ],
    [
      "maintenanceToBePaidBy",
      "maintenanceToBePaidBy"
    ],
    [
      "projectCondition",
      "projectCondition"
    ],
    [
      "internalImages",
      "internalImages"
    ],
    [
      "possessionDate",
      "possessionDate"
    ],
    [
      "rentalStatus",
      "rentalStatus"
    ],
    [
      "furnishedChecklist",
      "furnishedChecklist"
    ],
    [
      "specificComments",
      "specificComments"
    ],
    [
      "ownerUID",
      "ownerUID"
    ],
    [
      "isPreLeased",
      "isPreLeased"
    ],
    [
      "preLeasedType",
      "preLeasedType"
    ],
    [
      "agreementTerm",
      "agreementTerm"
    ],
    [
      "lockInPeriodPreLeased",
      "lockInPeriodPreLeased"
    ],
    [
      "rentalIncome",
      "rentalIncome"
    ],
    [
      "escalation",
      "escalation"
    ],
    [
      "tenantDetails",
      "tenantDetails"
    ],
    [
      "purpose",
      "purpose"
    ],
    [
      "specificRequirement",
      "specificRequirement"
    ]
  ]
};
