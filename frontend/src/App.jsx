import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MedicineList from './components/MedicineList';
import CustomerOrders from './components/CustomerOrders';
import CustomerSupport from './components/CustomerSupport';
import UserProfile from './components/UserProfile';
import AdminDashboard from './components/AdminDashboard';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import CartModal from './components/CartModal';
import PrescriptionUploadModal from './components/PrescriptionUploadModal';
import { authService, medicineService, orderService, prescriptionService, userService, isUserAdmin, normalizeUser } from './services/api';
import useAutoRefresh from './hooks/useAutoRefresh';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const isAdmin = isUserAdmin(currentUser);
  const [currentView, setCurrentView] = useState(() => (isUserAdmin(authService.getCurrentUser()) ? 'admin' : 'store')); // 'store' | 'orders' | 'support' | 'admin' | 'profile'
  const [adminTab, setAdminTab] = useState('customers');
  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [myOrders, setMyOrders] = useState([]);

  // Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);

  // Load Catalog Data (supports forced background refresh)
  const fetchCatalog = async (forceFresh = false) => {
    try {
      const [medRes, catRes] = await Promise.all([
        medicineService.getMedicines(selectedCategory, searchTerm, forceFresh),
        medicineService.getCategories(forceFresh)
      ]);
      setMedicines(medRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    }
  };

  const fetchUserOrders = async (forceFresh = false) => {
    if (currentUser) {
      try {
        const res = await orderService.getMyOrders(forceFresh);
        setMyOrders(res.data);
      } catch (err) {
        console.error('Error fetching user orders:', err);
      }
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [selectedCategory, searchTerm]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchUserOrders();
      refreshUserProfile();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (localStorage.getItem('pharma_token')) {
      refreshUserProfile();
    }
  }, []);

  // Periodic Auto-Refresh: Keep store inventory, user coins, and active orders freshly synced every 10 seconds
  useAutoRefresh(() => {
    if (currentView === 'store') {
      fetchCatalog(true);
    }
    if (currentUser) {
      fetchUserOrders(true);
      refreshUserProfile();
    }
  }, 10000);


  // Auth Handlers
  const handleLogin = async (username, password) => {
    const res = await authService.login(username, password);
    const data = normalizeUser(res.data);
    localStorage.setItem('pharma_token', data.accessToken || data.token);
    localStorage.setItem('pharma_user', JSON.stringify(data));
    setCurrentUser(data);

    // Auto-navigate to respective POV
    if (isUserAdmin(data)) {
      setCurrentView('admin');
      setAdminTab('customers');
    } else {
      setCurrentView('store');
    }
    refreshUserProfile();
  };

  const handleRegister = async (formData) => {
    await authService.register(formData);
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentView('store');
    setMyOrders([]);
  };

  // Cart Handlers
  const handleAddToCart = (medicine) => {
    setCart((prev) => {
      const existing = prev.find(item => item.medicine.id === medicine.id);
      const currentQty = existing ? existing.quantity : 0;
      const maxStock = medicine.stockQuantity ?? 0;

      if (currentQty >= maxStock) {
        alert(`Insufficient stock! Only ${maxStock} units of "${medicine.name}" are available in dispensary stock.`);
        return prev;
      }

      if (existing) {
        return prev.map(item =>
          item.medicine.id === medicine.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { medicine, quantity: 1 }];
    });
  };

  const handleUpdateCartQuantity = (medicineId, quantity) => {
    if (quantity <= 0) {
      handleRemoveFromCart(medicineId);
    } else {
      setCart((prev) => {
        const item = prev.find(it => it.medicine.id === medicineId);
        if (item) {
          const maxStock = item.medicine.stockQuantity ?? 0;
          if (quantity > maxStock) {
            alert(`Insufficient stock! Only ${maxStock} units of "${item.medicine.name}" are available in dispensary stock.`);
            return prev;
          }
        }
        return prev.map(item =>
          item.medicine.id === medicineId ? { ...item, quantity } : item
        );
      });
    }
  };

  const handleRemoveFromCart = (medicineId) => {
    setCart((prev) => prev.filter(item => item.medicine.id !== medicineId));
  };

  const handleDeleteMedicine = async (medicine) => {
    const medId = typeof medicine === 'object' ? medicine.id : medicine;
    const medName = typeof medicine === 'object' ? medicine.name : 'this medicine';

    if (!window.confirm(`Are you sure you want to permanently delete "${medName}" from listed medicines?`)) {
      return;
    }

    try {
      await medicineService.deleteMedicine(medId);
      alert(`"${medName}" deleted successfully!`);
      fetchCatalog(true);
      setCart((prev) => prev.filter(item => item.medicine.id !== medId));
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete medicine.';
      alert(msg);
    }
  };

  const refreshUserProfile = async () => {
    try {
      if (localStorage.getItem('pharma_token')) {
        const res = await userService.getMyProfile();
        if (res.data) {
          const profile = normalizeUser(res.data);
          setCurrentUser(prev => {
            if (!prev) {
              localStorage.setItem('pharma_user', JSON.stringify(profile));
              return profile;
            }
            if (
              prev.phCoins === profile.phCoins &&
              prev.fullName === profile.fullName &&
              prev.phone === profile.phone &&
              prev.address === profile.address &&
              JSON.stringify(prev.roles) === JSON.stringify(profile.roles)
            ) {
              return prev;
            }
            const updated = {
              ...prev,
              ...profile,
              accessToken: prev.accessToken || prev.token || localStorage.getItem('pharma_token'),
              token: prev.token || prev.accessToken || localStorage.getItem('pharma_token'),
              roles: (profile.roles && profile.roles.length > 0) ? profile.roles : prev.roles
            };
            localStorage.setItem('pharma_user', JSON.stringify(updated));
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Failed to sync profile:', err);
    }
  };

  const handleCheckout = async (orderPayload) => {
    await orderService.placeOrder(orderPayload);
    setCart([]);
    fetchCatalog(true); // refresh stock
    fetchUserOrders(true);
    await refreshUserProfile(); // refresh PH Coins balance immediately
    // Navigate to orders history view
    setCurrentView('orders');
  };

  const handlePrescriptionUpload = async (payload) => {
    await prescriptionService.uploadPrescription(payload);
  };

  const cartTotalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenRegister={() => setIsRegisterOpen(true)}
        onOpenCart={() => {
          refreshUserProfile();
          setIsCartOpen(true);
        }}
        cartCount={cartTotalCount}
        onOpenPrescription={() => setIsPrescriptionOpen(true)}
        onViewChange={setCurrentView}
        currentView={currentView}
        adminTab={adminTab}
        onAdminTabChange={setAdminTab}
      />

      {/* Main Content Area */}
      <main className="flex-grow-1">
        {/* VIEW 1: MEDICINES STORE */}
        {currentView === 'store' && (
          <>
            {isAdmin && (
              <div className="bg-dark text-white py-2 px-3 border-bottom border-secondary d-flex flex-wrap align-items-center justify-content-between gap-2 shadow-sm">
                <div className="d-flex align-items-center gap-2 small">
                  <span className="badge bg-success px-2 py-1">Admin Mode</span>
                  <span className="text-white-70">
                    You are browsing the Storefront in customer preview mode. You have admin deletion and management privileges.
                  </span>
                </div>
                <button 
                  className="btn btn-sm btn-outline-info py-1 px-3 d-flex align-items-center gap-1 fw-semibold"
                  onClick={() => {
                    setCurrentView('admin');
                    setAdminTab('customers');
                  }}
                >
                  <i className="bi bi-shield-lock-fill"></i>
                  <span>Return to Admin Control Center</span>
                </button>
              </div>
            )}
            <div className="bg-primary text-white py-5 text-center shadow-sm">
              <div className="container">
                <h1 className="fw-bolder display-5 mb-2">Authentic Medicines & Clinical Care</h1>
                <p className="lead mb-0 text-white-50">
                  Search through thousands of laboratory-tested medications, vitamins, and healthcare supplies.
                </p>
              </div>
            </div>

            <MedicineList
              medicines={medicines}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onAddToCart={handleAddToCart}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              isAdmin={isAdmin}
              onDeleteMedicine={handleDeleteMedicine}
            />
          </>
        )}

        {/* VIEW 2: CUSTOMER ORDERS & BILLS */}
        {currentView === 'orders' && (
          <CustomerOrders
            currentUser={currentUser}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}

        {/* VIEW 3: CUSTOMER SUPPORT */}
        {currentView === 'support' && (
          <CustomerSupport
            currentUser={currentUser}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}

        {/* VIEW 4: USER PROFILE (FOR BOTH ADMIN AND CUSTOMER) */}
        {currentView === 'profile' && (
          <UserProfile
            currentUser={currentUser}
            onUpdateUser={(updatedData) => {
              const normalized = normalizeUser(updatedData);
              setCurrentUser(prev => {
                if (!prev) return normalized;
                const merged = { ...prev, ...normalized };
                localStorage.setItem('pharma_user', JSON.stringify(merged));
                return merged;
              });
            }}
            onLogout={handleLogout}
          />
        )}

        {/* VIEW 5: ADMIN CONTROL CENTER */}
        {currentView === 'admin' && (
          <AdminDashboard
            categories={categories}
            onRefreshMedicines={fetchCatalog}
            activeTab={adminTab}
            onTabChange={setAdminTab}
          />
        )}
      </main>


      {/* Unified Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
        onSwitchToRegister={() => setIsRegisterOpen(true)}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onRegister={handleRegister}
        onSwitchToLogin={() => setIsLoginOpen(true)}
      />

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemove={handleRemoveFromCart}
        onCheckout={handleCheckout}
        currentUser={currentUser}
        onNavigateToOrders={() => setCurrentView('orders')}
        onOpenPrescription={() => {
          setIsCartOpen(false);
          setIsPrescriptionOpen(true);
        }}
      />

      <PrescriptionUploadModal
        isOpen={isPrescriptionOpen}
        onClose={() => setIsPrescriptionOpen(false)}
        onUpload={handlePrescriptionUpload}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginOpen(true)}
      />
    </div>
  );
}
