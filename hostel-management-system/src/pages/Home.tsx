import { useEffect, useState } from "react";
import {
  Building2,
  LogIn,
  UserPlus,
  BedDouble,
  ArrowRight,
  Utensils,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  GraduationCap,
  Leaf,
  Droplets,
  Wrench,
  Shield,
  Shirt,
  Dumbbell,
  BookOpen,
} from "lucide-react";
import { api } from "../lib/api";

type HomeProps = {
  onLogin: () => void;
  onSignup: () => void;
};

type LiveStats = {
  students: { total: number; active: number };
  rooms: { total: number; available: number; beds: number; bedsFilled: number; occupancyRate: number };
  fees: { paid: number; pending: number };
  complaints: { total: number; resolved: number };
};

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1523247669263-86d820b6937f?auto=format&fit=crop&w=1920&q=80";

function ImageWithFallback({ src, alt, className, fallbackColor, children }: { src: string; alt: string; className?: string; fallbackColor?: string; children?: JSX.Element }) {
  const [error, setError] = useState(false);
  return (
    <div className={`image-wrapper ${className || ""}`} style={{ backgroundColor: fallbackColor || "var(--surface-2)" }}>
      {!error && (
        <img
          src={src}
          alt={alt}
          className="content-image"
          onError={() => setError(true)}
          loading="lazy"
          decoding="async"
        />
      )}
      {error && children && (
        <div className="image-fallback">{children}</div>
      )}
    </div>
  );
}

function Home({ onLogin, onSignup }: HomeProps) {
  const [live, setLive] = useState<LiveStats | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [galleryItems, setGalleryItems] = useState<ImageItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  useEffect(() => {
    api<ImageItem[]>("/api/campus-gallery/public").then(setGalleryItems).catch((err) => setGalleryError(err.message || "Failed to load gallery")).finally(() => setGalleryLoading(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const resolution = live && live.complaints.total > 0
    ? Math.round((live.complaints.resolved / live.complaints.total) * 100)
    : 0;

  const imageUrl = (item: ImageItem) => item.image_url || "/placeholder.svg";

  return (
    <div className="public-home premium-home">

      {/* PUBLIC NAVBAR */}
      <header
        className={`public-navbar premium-nav ${scrolled ? "nav-scrolled" : ""}`}
      >
        <div className="public-brand">
          <div className="public-brand-icon premium-brand-icon">
            <Building2 size={26} className="brand-icon" />
          </div>
          <div>
            <h2 className="brand-name">HostelHub</h2>
            <span className="brand-tag">Management System</span>
          </div>
        </div>

        <nav className="public-nav">
          <a href="#home" className="nav-link active">Home</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="#facilities" className="nav-link">Campus</a>
          <a href="#why" className="nav-link">Why Choose Us</a>
          <a href="#about" className="nav-link">About</a>
        </nav>

        <div className="public-nav-actions">
          <button
            className="public-login-btn"
            onClick={onLogin}
            aria-label="Student Login"
          >
            <LogIn size={17} />
            <span>Login</span>
          </button>

          <button
            className="public-signup-btn premium-cta"
            onClick={onSignup}
            aria-label="Create Account"
          >
            <UserPlus size={17} />
            <span>Get Started</span>
          </button>
        </div>

        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Toggle menu"
          onClick={() => document.body.classList.toggle("nav-open")}
        >
          <span className="menu-line"></span>
          <span className="menu-line"></span>
          <span className="menu-line"></span>
        </button>
      </header>

      {/* MOBILE MENU OVERLAY */}
      <div className="mobile-menu-overlay" onClick={() => document.body.classList.remove("nav-open")}>
        <div className="mobile-menu">
          <a href="#home" className="mobile-link" onClick={() => document.body.classList.remove("nav-open")}>Home</a>
          <a href="#features" className="mobile-link" onClick={() => document.body.classList.remove("nav-open")}>Features</a>
          <a href="#facilities" className="mobile-link" onClick={() => document.body.classList.remove("nav-open")}>Campus</a>
          <a href="#why" className="mobile-link" onClick={() => document.body.classList.remove("nav-open")}>Why Choose Us</a>
          <a href="#about" className="mobile-link" onClick={() => document.body.classList.remove("nav-open")}>About</a>
          <div className="mobile-divider" />
          <button className="mobile-btn public-login-btn" onClick={() => { document.body.classList.remove("nav-open"); onLogin(); }}>
            <LogIn size={17} /> Login
          </button>
          <button className="mobile-btn public-signup-btn premium-cta" onClick={() => { document.body.classList.remove("nav-open"); onSignup(); }}>
            <UserPlus size={17} /> Get Started
          </button>
        </div>
      </div>

      {/* HERO SECTION */}
      <main id="home">
        <section className="public-hero premium-hero">
          <div className="hero-image-container">
            <ImageWithFallback
              src={HERO_IMAGE}
              alt="Green campus grounds with trees and lawns"
              className="hero-bg-image"
              fallbackColor="var(--surface-2)"
            />
            <div className="hero-overlay" />
          </div>

          <div className="hero-content">
            <div className="hero-badge premium-badge">
              <Sparkles size={15} />
              Smart Hostel Management
              <span className="premium-badge-dot" />
              v2.0 Live
            </div>

            <h1>
              Your Comfort.
              <br />
              <span className="hero-gradient-text">Your Community. Your Home.</span>
            </h1>

            <p className="hero-description">
              A modern, premium hostel management platform designed for students
              and administrators. From room allocation and mess management to
              leave applications and maintenance tracking — everything in one
              beautiful, easy-to-use place.
            </p>

            <div className="hero-stats">
              {live && (
                <>
                  <div className="hero-stat">
                    <span className="stat-value">{live.students.total}</span>
                    <span className="stat-label">Students</span>
                  </div>
                  <div className="hero-stat">
                    <span className="stat-value">{live.rooms.occupancyRate}%</span>
                    <span className="stat-label">Occupancy</span>
                  </div>
                  <div className="hero-stat">
                    <span className="stat-value">{resolution}%</span>
                    <span className="stat-label">Requests Resolved</span>
                  </div>
                </>
              )}
            </div>

            <div className="hero-actions">
              <button
                className="hero-primary-btn premium-primary"
                onClick={onLogin}
                aria-label="Student Login"
              >
                <LogIn size={18} />
                <span>Student Login</span>
              </button>
              <button
                className="hero-secondary-btn premium-secondary"
                onClick={onSignup}
                aria-label="Create Account"
              >
                <UserPlus size={18} />
                <span>Register Now</span>
              </button>
            </div>

            <div className="hero-trust">
              <div className="trust-item">
                <Shield size={16} />
                <span>Secure & Private</span>
              </div>
              <div className="trust-divider" />
              <div className="trust-item">
                <Leaf size={16} />
                <span>Eco-Friendly Campus</span>
              </div>
              <div className="trust-divider" />
              <div className="trust-item">
                <Phone size={16} />
                <span>24/7 Support</span>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section className="premium-features" id="features">
          <div className="section-header">
            <span className="section-eyebrow">What We Offer</span>
            <h2>Everything you need for hostel life</h2>
            <p>From check-in to check-out, every facility is just a tap away.</p>
          </div>

          <div className="feature-grid">
            <FeatureCard
              icon={<BedDouble size={26} className="feature-icon" />}
              title="Smart Room Allocation"
              description="View your assigned room, bed details, amenities, and room photos. Track occupancy and request room changes."
              imageKey="rooms"
            />
            <FeatureCard
              icon={<Utensils size={26} className="feature-icon" />}
              title="Mess & Meal Plans"
              description="Daily breakfast, lunch, and dinner menus with photos. Rate food quality and share feedback with mess staff."
              imageKey="mess"
            />
            <FeatureCard
              icon={<BookOpen size={26} className="feature-icon" />}
              title="Study Rooms & Library"
              description="Book study spaces, check timings, and access Wi-Fi-enabled quiet zones for focused learning."
              imageKey="study"
            />
            <FeatureCard
              icon={<Dumbbell size={26} className="feature-icon" />}
              title="Gym & Recreation"
              description="Access gym facilities, view equipment, and reserve time slots for workouts and recreation."
              imageKey="gym"
            />
            <FeatureCard
              icon={<Shield size={26} className="feature-icon" />}
              title="Medical & Emergency"
              description="On-campus medical room, emergency contacts, nearby hospitals, and ambulance services — always ready."
              imageKey="medical"
            />
            <FeatureCard
              icon={<Wrench size={26} className="feature-icon" />}
              title="Maintenance Requests"
              description="Report issues with photos, track progress, and get quick resolutions from our maintenance team."
              imageKey="housekeeping"
            />
          </div>
        </section>

        {/* CAMPUS FACILITIES GALLERY */}
        <section className="premium-gallery" id="facilities">
          <div className="section-header">
            <span className="section-eyebrow">Campus Facilities</span>
            <h2>Explore our campus</h2>
            <p>Modern facilities designed for comfortable student living.</p>
          </div>

          <div className="gallery-grid">
            <GalleryItem
              key="rooms"
              title="Hostel Rooms"
              subtitle="Comfortable living spaces"
              imageKey="rooms"
              icon={<BedDouble size={20} />}
            />
            <GalleryItem
              key="mess"
              title="Mess & Dining"
              subtitle="Hygienic, nutritious meals"
              imageKey="mess"
              icon={<Utensils size={20} />}
            />
            <GalleryItem
              key="study"
              title="Study Room"
              subtitle="Quiet, Wi-Fi enabled space"
              imageKey="study"
              icon={<BookOpen size={20} />}
            />
            <GalleryItem
              key="gym"
              title="Gym & Fitness"
              subtitle="Modern exercise equipment"
              imageKey="gym"
              icon={<Dumbbell size={20} />}
            />
            <GalleryItem
              key="medical"
              title="Medical Room"
              subtitle="First-aid & health support"
              imageKey="medical"
              icon={<Shield size={20} />}
            />
            <GalleryItem
              key="housekeeping"
              title="Housekeeping"
              subtitle="Clean & well-maintained"
              imageKey="housekeeping"
              icon={<Shirt size={20} />}
            />
          </div>
        </section>

        {/* WHY CHOOSE US */}
        <section className="premium-why" id="why">
          <div className="section-header">
            <span className="section-eyebrow">Why HostelHub</span>
            <h2>Trusted by students and administrators</h2>
            <p>A platform built with care for hostel life.</p>
          </div>

          <div className="why-grid">
            <WhyItem
              icon={<GraduationCap size={24} className="why-icon" />}
              title="Student-Centric Design"
              description="Built for students — easy to use, mobile-friendly, and accessible on any device."
            />
            <WhyItem
              icon={<Leaf size={24} className="why-icon" />}
              title="Eco-Friendly Campus"
              description="Nature-inspired design with green spaces, sustainability, and a healthy living environment."
            />
            <WhyItem
              icon={<Droplets size={24} className="why-icon" />}
              title="Real-Time Updates"
              description="Leave status, maintenance progress, mess menus, and notices — always up to date."
            />
            <WhyItem
              icon={<Calendar size={24} className="why-icon" />}
              title="Transparent Tracking"
              description="Track every request from submission to resolution with timestamps and admin remarks."
            />
          </div>
        </section>

        {/* CONTACT & EMERGENCY */}
        <section className="premium-contact">
          <div className="contact-grid">
            <div className="contact-card">
              <div className="contact-icon">
                <Phone size={24} />
              </div>
              <div>
                <h3>Hostel Warden</h3>
                <p>24x7 emergency assistance</p>
                <a href="tel:+919876501234" className="contact-link">+91 98765 01234</a>
              </div>
            </div>
            <div className="contact-card">
              <div className="contact-icon">
                <Shield size={24} />
              </div>
              <div>
                <h3>Security Office</h3>
                <p>Main gate & entry/exit register</p>
                <a href="tel:+919876506666" className="contact-link">+91 98765 06666</a>
              </div>
            </div>
            <div className="contact-card">
              <div className="contact-icon">
                <Mail size={24} />
              </div>
              <div>
                <h3>Email Support</h3>
                <p>General inquiries & feedback</p>
                <a href="mailto:support@hostelhub.example" className="contact-link">support@hostelhub.example</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="premium-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="public-brand-icon premium-brand-icon">
              <Building2 size={24} className="brand-icon" />
            </div>
            <div>
              <h3 className="brand-name">HostelHub</h3>
              <span className="brand-tag">Management System</span>
            </div>
          </div>

          <div className="footer-links-grid">
            <div className="footer-link-group">
              <h4>Platform</h4>
              <a href="#features">Features</a>
              <a href="#facilities">Campus Facilities</a>
              <a href="#why">Why Choose Us</a>
              <a href="#about">About</a>
            </div>
            <div className="footer-link-group">
              <h4>Student Services</h4>
              <a href="#">My Profile</a>
              <a href="#">My Room</a>
              <a href="#">Mess & Food</a>
              <a href="#">Leave Applications</a>
            </div>
            <div className="footer-link-group">
              <h4>Support</h4>
              <a href="#">Maintenance</a>
              <a href="#">Housekeeping</a>
              <a href="#">Medical & Emergency</a>
              <a href="#">Settings</a>
            </div>
            <div className="footer-link-group">
              <h4>Admin</h4>
              <a href="#">Dashboard</a>
              <a href="#">Reports</a>
              <a href="#">Notices</a>
              <a href="#">Facilities</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="creator-brand">
            Designed &amp; Developed by <strong>TUSHAR CHAUDHARY</strong>
          </p>
          <p className="footer-copy">
            © 2026 HostelHub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ================= SUB-COMPONENTS ================= */

function FeatureCard({ icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="feature-card premium">
      <div className="feature-image">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1502672260266-1c1ef1d77368?auto=format&fit=crop&w=800&q=80"
          alt={title}
          fallbackColor="var(--primary-soft)"
        >
          {icon}
        </ImageWithFallback>
      </div>
      <div className="feature-body">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function GalleryItem({ item }: { item: ImageItem }) {
  return (
    <div className="gallery-item premium">
      <div className="gallery-image">
        <ImageWithFallback
          src={item.image_url || "/placeholder.svg"}
          alt={item.title}
          fallbackColor="var(--surface-3)"
        >
          {item.is_cover && <Star2 size={20} />}
        </ImageWithFallback>
        <div className="gallery-overlay">
          <div className="gallery-info">
            <strong>{item.title}</strong>
            <span>{item.description || ""}</span>
          </div>
          <ArrowRight size={16} className="gallery-arrow" />
        </div>
      </div>
    </div>
  );
}

function WhyItem({ icon, title, description }: { icon: JSX.Element; title: string; description: string }) {
  return (
    <div className="why-card premium">
      <div className="why-icon-bg">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default Home;