package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Bid scoring structures
type BidData struct {
	ID                  string                 `json:"id"`
	TenderID           string                 `json:"tenderId"`
	VendorID           string                 `json:"vendorId"`
	TechnicalProposal  map[string]interface{} `json:"technicalProposal"`
	CommercialProposal map[string]interface{} `json:"commercialProposal"`
	FinancialProposal  map[string]interface{} `json:"financialProposal"`
}

type ScoringCriteria struct {
	TechnicalWeight   float64                `json:"technicalWeight"`
	CommercialWeight  float64                `json:"commercialWeight"`
	FinancialWeight   float64                `json:"financialWeight"`
	Criteria          map[string]interface{} `json:"criteria"`
}

type ScoreResult struct {
	BidID            string  `json:"bidId"`
	TechnicalScore   float64 `json:"technicalScore"`
	CommercialScore  float64 `json:"commercialScore"`
	FinancialScore   float64 `json:"financialScore"`
	TotalScore       float64 `json:"totalScore"`
	Recommendation   string  `json:"recommendation"`
	RiskAssessment   string  `json:"riskAssessment"`
}

type UserClaims struct {
	UserID   string `json:"sub"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// JWT middleware for role verification
func verifyJWT(tokenString string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// Role-based access control middleware
func requireRole(allowedRoles ...string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Authorization header required", http.StatusUnauthorized)
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := verifyJWT(tokenString)
			if err != nil {
				http.Error(w, "Invalid token", http.StatusUnauthorized)
				return
			}

			// Check if user has required role
			hasRole := false
			for _, role := range allowedRoles {
				if claims.Role == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				http.Error(w, fmt.Sprintf("Access denied. Required roles: %v", allowedRoles), http.StatusForbidden)
				return
			}

			// Add user context to request
			ctx := context.WithValue(r.Context(), "user", claims)
			next(w, r.WithContext(ctx))
		}
	}
}

// Core scoring algorithm with role-gated logic
func scoreBid(bidData BidData, criteria ScoringCriteria, userRole string) (*ScoreResult, error) {
	// Role-based access control for scoring
	if userRole != "USER" && userRole != "ADMIN" {
		return nil, fmt.Errorf("forbidden: insufficient permissions for scoring")
	}

	var technicalScore, commercialScore, financialScore float64

	// Technical scoring (simplified algorithm)
	if bidData.TechnicalProposal != nil {
		technicalScore = calculateTechnicalScore(bidData.TechnicalProposal, criteria.Criteria)
	}

	// Commercial scoring
	if bidData.CommercialProposal != nil {
		commercialScore = calculateCommercialScore(bidData.CommercialProposal, criteria.Criteria)
	}

	// Financial scoring
	if bidData.FinancialProposal != nil {
		financialScore = calculateFinancialScore(bidData.FinancialProposal, criteria.Criteria)
	}

	// Weighted total score
	totalScore := (technicalScore * criteria.TechnicalWeight) +
		(commercialScore * criteria.CommercialWeight) +
		(financialScore * criteria.FinancialWeight)

	// Risk assessment based on total score
	var riskAssessment string
	if totalScore < 0.2 {
		riskAssessment = "HIGH_RISK"
	} else if totalScore < 0.6 {
		riskAssessment = "MEDIUM_RISK"
	} else {
		riskAssessment = "LOW_RISK"
	}

	// Recommendation based on score
	var recommendation string
	if totalScore >= 0.8 {
		recommendation = "STRONGLY_RECOMMENDED"
	} else if totalScore >= 0.6 {
		recommendation = "RECOMMENDED"
	} else if totalScore >= 0.4 {
		recommendation = "CONDITIONAL"
	} else {
		recommendation = "NOT_RECOMMENDED"
	}

	// Log scoring activity for audit
	log.Printf("Bid %s scored by user role %s: Total=%.2f, Risk=%s, Recommendation=%s", 
		bidData.ID, userRole, totalScore, riskAssessment, recommendation)

	return &ScoreResult{
		BidID:           bidData.ID,
		TechnicalScore:  technicalScore,
		CommercialScore: commercialScore,
		FinancialScore:  financialScore,
		TotalScore:      totalScore,
		Recommendation:  recommendation,
		RiskAssessment:  riskAssessment,
	}, nil
}

// Simplified scoring functions (in real implementation, these would be more complex)
func calculateTechnicalScore(proposal map[string]interface{}, criteria map[string]interface{}) float64 {
	// Basic implementation - in reality this would be much more sophisticated
	score := 0.7 // Base score
	
	if experience, ok := proposal["experience"]; ok {
		if exp, ok := experience.(float64); ok && exp > 5 {
			score += 0.2
		}
	}
	
	if certifications, ok := proposal["certifications"]; ok {
		if certs, ok := certifications.([]interface{}); ok && len(certs) > 3 {
			score += 0.1
		}
	}
	
	if score > 1.0 {
		score = 1.0
	}
	
	return score
}

func calculateCommercialScore(proposal map[string]interface{}, criteria map[string]interface{}) float64 {
	score := 0.6 // Base score
	
	if deliveryTime, ok := proposal["deliveryTime"]; ok {
		if delivery, ok := deliveryTime.(float64); ok && delivery <= 30 {
			score += 0.3
		}
	}
	
	if warranty, ok := proposal["warranty"]; ok {
		if warr, ok := warranty.(float64); ok && warr >= 12 {
			score += 0.1
		}
	}
	
	if score > 1.0 {
		score = 1.0
	}
	
	return score
}

func calculateFinancialScore(proposal map[string]interface{}, criteria map[string]interface{}) float64 {
	score := 0.5 // Base score
	
	if price, ok := proposal["totalPrice"]; ok {
		if totalPrice, ok := price.(float64); ok {
			// Lower price gets higher score (inverse relationship)
			if totalPrice <= 100000 {
				score = 1.0
			} else if totalPrice <= 500000 {
				score = 0.8
			} else if totalPrice <= 1000000 {
				score = 0.6
			} else {
				score = 0.3
			}
		}
	}
	
	return score
}

// HTTP handlers
func scoreBidHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := r.Context().Value("user").(*UserClaims)

	var request struct {
		BidData BidData         `json:"bidData"`
		Criteria ScoringCriteria `json:"criteria"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	result, err := scoreBid(request.BidData, request.Criteria, user.Role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":      "healthy",
		"service":     "bid-scoring",
		"version":     "1.0.0",
		"role_access": []string{"USER", "ADMIN"},
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// gRPC server implementation would go here
// For brevity, focusing on HTTP implementation

func main() {
	// Load environment variables
	port := os.Getenv("GO_SCORING_SERVICE_PORT")
	if port == "" {
		port = "9090"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	// Setup HTTP router
	r := mux.NewRouter()
	
	// Health check (no auth required)
	r.HandleFunc("/health", healthHandler).Methods("GET")
	
	// Scoring endpoint (requires USER or ADMIN role)
	r.HandleFunc("/score", requireRole("USER", "ADMIN")(scoreBidHandler)).Methods("POST")

	// CORS middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	})

	// Start HTTP server
	log.Printf("🚀 Go Scoring Service starting on port %s", port)
	log.Printf("🔒 Role-based access: USER, ADMIN only")
	log.Printf("📊 Available endpoints:")
	log.Printf("   GET  /health - Health check")
	log.Printf("   POST /score  - Score bid (requires auth)")
	
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}