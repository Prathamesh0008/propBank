// Generated from unchanged Go source for isolated contract comparison.
package main
import ("encoding/json"; "encoding/base64"; "path/filepath"; "reflect"; "time"; "os"; "fmt"; "strings"; "shoprop-backend/models")
type PropertyHandler struct {}
func parsePrice(priceStr string) (float64, error) {
	// Remove common currency symbols and spaces
	cleanPrice := strings.ReplaceAll(priceStr, "₹", "")
	cleanPrice = strings.ReplaceAll(cleanPrice, ",", "")
	cleanPrice = strings.TrimSpace(cleanPrice)

	if cleanPrice == "" {
		return 0, fmt.Errorf("empty price")
	}

	var price float64
	if _, err := fmt.Sscanf(cleanPrice, "%f", &price); err != nil {
		return 0, err
	}

	return price, nil
}

// convertToPropertyResponse converts a Property model to a PropertyResponse
func (h *PropertyHandler) convertToPropertyResponse(property models.Property) models.PropertyResponse {
	displayPrice := property.Price
	if displayPrice == 0 {
		if property.ListingType == "rent" && property.MonthlyRent != "" {
			if parsedRent, err := parsePrice(property.MonthlyRent); err == nil {
				displayPrice = parsedRent
			}
		} else if property.ListingType == "sell" && property.SellingPrice != "" {
			if parsedPrice, err := parsePrice(property.SellingPrice); err == nil {
				displayPrice = parsedPrice
			}
		}
	}

	return models.PropertyResponse{
		ID:                    property.ID,
		Title:                 property.Title,
		Description:           property.Description,
		Price:                 displayPrice,
		Address:               property.Address,
		City:                  property.City,
		State:                 property.State,
		ZipCode:               property.ZipCode,
		PropertyType:          property.PropertyType,
		ListingType:           property.ListingType,
		Configuration:         property.Configuration,
		UnitNumber:            property.UnitNumber,
		Floor:                 property.Floor,
		Location:              property.Location,
		CarpetArea:            property.CarpetArea,
		ConstructedArea:       property.ConstructedArea,
		SquareFeet:            property.SquareFeet,
		TenantName:            property.TenantName,
		PersonName:            property.PersonName,
		MobileNumber:          property.MobileNumber,
		PrimaryNo:             property.PrimaryNo,
		UltNo:                 property.UltNo,
		MonthlyRent:           property.MonthlyRent,
		SellingPrice:          property.SellingPrice,
		MonthlyRent1stYear:    property.MonthlyRent1stYear,
		MonthlyRent2ndYear:    property.MonthlyRent2ndYear,
		MonthlyRent3rdYear:    property.MonthlyRent3rdYear,
		MonthlyRent4thYear:    property.MonthlyRent4thYear,
		RentFromDate1:         property.RentFromDate1,
		RentToDate1:           property.RentToDate1,
		RentFromDate2:         property.RentFromDate2,
		RentToDate2:           property.RentToDate2,
		PaymentDueDate:        property.PaymentDueDate,
		EscalationPercentage:  property.EscalationPercentage,
		EscalationAmount:      property.EscalationAmount,
		SecurityDeposit:       property.SecurityDeposit,
		AgreementPeriod:       property.AgreementPeriod,
		AgreementStartDate:    property.AgreementStartDate,
		AgreementEndDate:      property.AgreementEndDate,
		NoticePeriod:          property.NoticePeriod,
		LockInPeriod:          property.LockInPeriod,
		UnitCondition:         property.UnitCondition,
		MaintenanceToBePaidBy: property.MaintenanceToBePaidBy,
		ProjectCondition:      property.ProjectCondition,
		PossessionDate:        property.PossessionDate,
		RentalStatus:          property.RentalStatus,
		FurnishedChecklist:    property.FurnishedChecklist,
		Images:                property.Images,
		SpecificComments:      property.SpecificComments,
		Tenants:               property.Tenants,
		Buyers:                property.Buyers,
		OwnerUID:              property.OwnerUID,
		OwnerName:             property.OwnerName,
		OwnerEmail:            property.OwnerEmail,
		OwnerPhone:            property.OwnerPhone,
		OwnerRole:             property.OwnerRole,
		WantToSell:            property.WantToSell,
		Status:                property.Status,
		IsActive:              property.IsActive,
		IsSold:                property.IsSold,
		CreatedAt:             property.CreatedAt,
		UpdatedAt:             property.UpdatedAt,
		Bedrooms:              property.Bedrooms,
		Bathrooms:             property.Bathrooms,
		RentSchedule:          property.RentSchedule,

		// Pre-leased Details
		IsPreLeased:           property.IsPreLeased,
		PreLeasedType:         property.PreLeasedType,
		AgreementTerm:         property.AgreementTerm,
		LockInPeriodPreLeased: property.LockInPeriodPreLeased,
		RentalIncome:          property.RentalIncome,
		Escalation:            property.Escalation,
		TenantDetails:         property.TenantDetails,
		Purpose:               property.Purpose,
		SpecificRequirement:   property.SpecificRequirement,
	}
}


type R2StorageService struct {}
func (s *R2StorageService) parseBase64Image(base64Image string) ([]byte, string, error) {
	// Expected format: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...
	parts := strings.Split(base64Image, ",")
	if len(parts) != 2 {
		return nil, "", fmt.Errorf("invalid base64 format")
	}

	// Extract content type from header
	header := parts[0]
	contentType := "image/jpeg" // default
	if strings.Contains(header, "image/png") {
		contentType = "image/png"
	} else if strings.Contains(header, "image/gif") {
		contentType = "image/gif"
	} else if strings.Contains(header, "image/webp") {
		contentType = "image/webp"
	} else if strings.Contains(header, "application/pdf") {
		contentType = "application/pdf"
	}

	// Decode base64 data
	imageData, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode base64: %v", err)
	}

	return imageData, contentType, nil
}

func (s *R2StorageService) getExtensionFromContentType(contentType string) string {
	switch contentType {
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "application/pdf":
		return ".pdf"
	default:
		return ".jpg"
	}
}


func (s *R2StorageService) generateFilename(originalName string, folder string, seconds int64) string {
	ext := filepath.Ext(originalName)
	timestamp := seconds
	baseName := strings.TrimSuffix(originalName, ext)
	// Sanitize filename
	baseName = strings.ReplaceAll(baseName, " ", "_")
	return fmt.Sprintf("%s/%s_%d%s", folder, baseName, timestamp, ext)
}


func main() {
 var req struct { Kind string; Data json.RawMessage; Store bool };
 if err:=json.NewDecoder(os.Stdin).Decode(&req);err!=nil {panic(err)}
 var result interface{}
 switch req.Kind {
case "Visit": var p models.Visit; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "CreateVisitRequest": var p models.CreateVisitRequest; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "UpdateVisitRequest": var p models.UpdateVisitRequest; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "Tenant": var p models.Tenant; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "CreateTenantRequest": var p models.CreateTenantRequest; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "Document": var p models.Document; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "CreateDocumentRequest": var p models.CreateDocumentRequest; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "AdminNotification": var p models.AdminNotification; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "CreateAdminNotificationRequest": var p models.CreateAdminNotificationRequest; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "Property": var p models.Property; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "User": var p models.User; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "Review": var p models.Review; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "CreateReviewRequest": var p models.CreateReviewRequest; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "InspectionReport": var p models.InspectionReport; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "CreateInspectionReportRequest": var p models.CreateInspectionReportRequest; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "Service": var p models.Service; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "ServiceRequest": var p models.ServiceRequest; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "SiteSettings": var p models.SiteSettings; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
case "r2": var data string;json.Unmarshal(req.Data,&data);s:=&R2StorageService{};bytes,mime,err:=s.parseBase64Image(data);if err!=nil{result=map[string]string{"error":err.Error()}}else{result=map[string]string{"bytes":base64.StdEncoding.EncodeToString(bytes),"contentType":mime,"extension":s.getExtensionFromContentType(mime)}}
case "filename": var data struct{Name string;Folder string;Seconds int64};json.Unmarshal(req.Data,&data);result=(&R2StorageService{}).generateFilename(data.Name,data.Folder,data.Seconds)
 case "property": var p models.Property; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=(&PropertyHandler{}).convertToPropertyResponse(p)}
 case "request": var p models.CreatePropertyRequest; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
 case "user": var p models.User; if err:=json.Unmarshal(req.Data,&p);err!=nil{result=map[string]interface{}{"error":err.Error()}}else{result=p}
 }
 if req.Store {result=firestoreFields(reflect.ValueOf(result))}; json.NewEncoder(os.Stdout).Encode(result)
}

var typeOfGoTime=reflect.TypeOf(time.Time{})
// isEmptyValue copied from cloud.google.com/go/firestore v1.18.0.
func isEmptyValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String:
		return v.Len() == 0
	case reflect.Bool:
		return !v.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return v.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return v.Float() == 0
	case reflect.Interface, reflect.Ptr:
		return v.IsNil()
	}
	if v.Type() == typeOfGoTime {
		return v.Interface().(time.Time).IsZero()
	}
	return false
}

func firestoreFields(v reflect.Value) interface{} {
 if !v.IsValid(){return nil};if v.Kind()==reflect.Interface||v.Kind()==reflect.Ptr{if v.IsNil(){return nil};return firestoreFields(v.Elem())}
 if v.Type()==typeOfGoTime{return v.Interface()}
 switch v.Kind(){
 case reflect.Struct: result:=map[string]interface{}{};t:=v.Type();for i:=0;i<v.NumField();i++{f:=t.Field(i);tag:=f.Tag.Get("firestore");parts:=strings.Split(tag,",");name:=parts[0];if name=="-"{continue};if name==""{name=f.Name};omit:=false;for _,p:=range parts[1:]{if p=="omitempty"{omit=true}};if omit&&isEmptyValue(v.Field(i)){continue};result[name]=firestoreFields(v.Field(i))};return result
 case reflect.Slice,reflect.Array:if v.Kind()==reflect.Slice&&v.IsNil(){return nil};result:=make([]interface{},v.Len());for i:=range result{result[i]=firestoreFields(v.Index(i))};return result
 };return v.Interface()
}
