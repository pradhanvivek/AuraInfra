import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setIsOpen(false)
    }
  }

  return (
    <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm z-50 shadow-sm">
      <div className="container-custom">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">AuraInfra<span className="text-primary">.ai</span></span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <button onClick={() => scrollToSection('features')} className="text-gray-700 hover:text-primary transition">Features</button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-gray-700 hover:text-primary transition">How It Works</button>
            <button onClick={() => scrollToSection('testimonials')} className="text-gray-700 hover:text-primary transition">Testimonials</button>
            <button onClick={() => scrollToSection('contact')} className="text-gray-700 hover:text-primary transition">Contact</button>
            <button className="bg-primary text-white px-6 py-2 rounded-full hover:bg-blue-600 transition">
              Download App
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 space-y-4">
            <button onClick={() => scrollToSection('features')} className="block w-full text-left py-2 text-gray-700">Features</button>
            <button onClick={() => scrollToSection('how-it-works')} className="block w-full text-left py-2 text-gray-700">How It Works</button>
            <button onClick={() => scrollToSection('testimonials')} className="block w-full text-left py-2 text-gray-700">Testimonials</button>
            <button onClick={() => scrollToSection('contact')} className="block w-full text-left py-2 text-gray-700">Contact</button>
            <button className="w-full bg-primary text-white px-6 py-2 rounded-full">
              Download App
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
