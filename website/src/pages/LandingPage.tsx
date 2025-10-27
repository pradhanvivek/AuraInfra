import Navbar from '../components/Navbar'
import { Smartphone, TrendingUp, MapPin, FileText, Wrench, Compass, Star, Mail, Send, Download } from 'lucide-react'

export default function LandingPage() {
  const features = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Property Health Score',
      description: 'AI-powered scoring system that evaluates your property across documents, fixtures, measurements, and Vastu compliance. Get actionable recommendations to improve your score.',
      color: 'bg-primary'
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: 'Google Maps Integration',
      description: 'Find nearby hospitals, schools, malls, and essential services within 2km radius. Get directions and distance calculations instantly.',
      color: 'bg-success'
    },
    {
      icon: <Compass className="w-8 h-8" />,
      title: 'Vastu Analysis',
      description: 'Upload your floor plan and get comprehensive Vastu compliance analysis powered by AI. Optimize your space for positive energy.',
      color: 'bg-secondary'
    },
    {
      icon: <Wrench className="w-8 h-8" />,
      title: 'Fixture & Warranty Tracking',
      description: 'Track all appliances, warranties, and vendor information. Get reminders before warranties expire and schedule periodic maintenance easily.',
      color: 'bg-warning'
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: 'Document Management',
      description: 'Store and view all property documents including PDFs and images. Keep ownership papers, insurance, and maintenance records organized.',
      color: 'bg-danger'
    },
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: 'Cross-Platform',
      description: 'Available on iOS, Android, and Web. Sync your data seamlessly across all devices with secure cloud storage.',
      color: 'bg-secondary'
    }
  ]

  const testimonials = [
    {
      name: 'Rajesh Kumar',
      role: 'Property Owner',
      content: 'AuraInfra.ai has made managing my properties so much easier! The health score feature helps me stay on top of maintenance, and the warranty reminders have saved me thousands.',
      rating: 5
    },
    {
      name: 'Priya Sharma',
      role: 'Real Estate Investor',
      content: 'The Vastu analysis feature is incredibly accurate. I use it for all my new acquisitions. The Near Me feature also helps me assess property locations quickly.',
      rating: 5
    },
    {
      name: 'Amit Patel',
      role: 'Homeowner',
      content: 'Finally, a simple app to keep track of all my appliances and their warranties! The vendor contact feature is brilliant for scheduling quarterly AC maintenance.',
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fadeInUp">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Smart Property Management, <span className="text-primary">AI-Powered</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Track health scores, manage documents, analyze Vastu, and find nearby services—all in one intelligent platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="btn-primary">
                  Try Web App
                </button>
                <button className="btn-secondary">
                  <Download className="w-5 h-5 inline mr-2" />
                  Download App
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-4">Available on iOS, Android, and Web</p>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-8 shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <div className="bg-white rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">Property Health</span>
                    <span className="text-3xl font-bold text-success">A</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Overall Score</span>
                      <span className="font-semibold text-primary">92%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-success w-[92%]"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-gray-600">Documents</div>
                      <div className="text-lg font-bold text-primary">95%</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs text-gray-600">Fixtures</div>
                      <div className="text-lg font-bold text-success">100%</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-xs text-gray-600">Measurements</div>
                      <div className="text-lg font-bold text-secondary">88%</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <div className="text-xs text-gray-600">Vastu</div>
                      <div className="text-lg font-bold text-warning">85%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to manage your properties intelligently
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100"
              >
                <div className={`${feature.color} w-16 h-16 rounded-xl flex items-center justify-center text-white mb-6`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="section bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Add Your Property',
                description: 'Create a property profile with Google Maps address autocomplete and automatic coordinate capture.',
                icon: <MapPin className="w-12 h-12" />
              },
              {
                step: '2',
                title: 'Upload Documents & Details',
                description: 'Add documents, fixtures with warranties, room measurements, and floor plans for Vastu analysis.',
                icon: <FileText className="w-12 h-12" />
              },
              {
                step: '3',
                title: 'Get Health Insights',
                description: 'Receive AI-powered health scores and actionable recommendations to improve your property value.',
                icon: <TrendingUp className="w-12 h-12" />
              }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold">
                    {item.step}
                  </div>
                  <div className="text-primary mb-6 flex justify-center mt-4">
                    {item.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="section bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What Our Users Say</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join thousands of satisfied property owners
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-blue-50 p-8 rounded-2xl shadow-lg">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">"{testimonial.content}"</p>
                <div>
                  <p className="font-bold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="section bg-gradient-to-br from-primary to-secondary text-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Get In Touch</h2>
              <p className="text-xl text-blue-100">
                Have questions? We'd love to hear from you.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-6">Contact Information</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <Mail className="w-6 h-6 mr-4 mt-1" />
                    <div>
                      <p className="font-semibold">Email Support</p>
                      <p className="text-blue-100">support@aurainfra.ai</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Send className="w-6 h-6 mr-4 mt-1" />
                    <div>
                      <p className="font-semibold">Quick Response</p>
                      <p className="text-blue-100">We typically respond within 24 hours</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-6">Send a Message</h3>
                <form className="space-y-4">
                  <input
                    type="email"
                    placeholder="Your email"
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 placeholder-white/60 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <textarea
                    placeholder="Your message"
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 placeholder-white/60 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                  ></textarea>
                  <button className="w-full bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition">
                    Send Message
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container-custom">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">A</span>
                </div>
                <span className="text-xl font-bold">AuraInfra<span className="text-primary">.ai</span></span>
              </div>
              <p className="text-gray-400">Smart Property Management, AI-Powered</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">About Us</a></li>
                <li><a href="#contact" className="hover:text-white transition">Contact</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Download</h4>
              <div className="space-y-3">
                <a href="#" className="block bg-white text-gray-900 px-4 py-2 rounded-lg text-center hover:bg-gray-100 transition">
                  <div className="font-semibold">Download on the</div>
                  <div className="text-sm">App Store</div>
                </a>
                <a href="#" className="block bg-white text-gray-900 px-4 py-2 rounded-lg text-center hover:bg-gray-100 transition">
                  <div className="font-semibold">GET IT ON</div>
                  <div className="text-sm">Google Play</div>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2025 AuraInfra.ai. All rights reserved. | Privacy Policy | Terms of Service</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
