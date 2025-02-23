import { ref, computed } from 'vue'
import type { CapacityData, JobData, JobUsage, DailyData } from '../types/chart.types'
import capacityDataImport from '../assets/data/capacity-data.json' assert { type: 'json' }
import operationDataImport from '../assets/data/operation-data.json' assert { type: 'json' }

const fetchJson = async (url: string) => {
  const response = await fetch(url)
  return response.json()
}

export function useChartData() {
  const data = ref<CapacityData[]>([])
  const jobs = ref<JobData[]>([])
  
  const initializeData = () => {
    try {
      // Process capacity data
      const capacityArray = (Array.isArray(capacityDataImport) 
        ? capacityDataImport 
        : (capacityDataImport as any).data || []) as CapacityData[]
      data.value = capacityArray

      // Process operation data
      const operationArray = (Array.isArray(operationDataImport)
        ? operationDataImport
        : (operationDataImport as any).data || []) as JobData[]
      
      jobs.value = operationArray
    } catch (error) {
      console.error('Error initializing data:', error)
    }
  }

  const resourceGroups = computed(() => {
    return [...new Set(data.value.map((item: CapacityData) => item.resourceGroupId))]
  })

  // Helper to get processing hours for a specific date
  const getProcessingHoursForDate = (job: JobData, date: Date, useScheduled: boolean): number => {
    // Convert millisecond timestamps to dates
    const plannedStartDate = new Date(Number(job["Planned Start Date"]))
    const scheduledStartDate = job["Scheduled Start Date"] ? new Date(Number(job["Scheduled Start Date"])) : null
    const dateToCheck = new Date(date)
    
    // Reset all times to start of day for comparison
    dateToCheck.setHours(0, 0, 0, 0)
    plannedStartDate.setHours(0, 0, 0, 0)
    if (scheduledStartDate) {
      scheduledStartDate.setHours(0, 0, 0, 0)
    }

    // Debug logging
    console.log('Checking dates:', {
      job: job.Job,
      resourceGroup: job.resourceGroupId,
      dateToCheck: dateToCheck.toISOString(),
      plannedStart: plannedStartDate.toISOString(),
      scheduledStart: scheduledStartDate?.toISOString(),
      useScheduled
    })
    
    // Use scheduled date if available and requested
    const startDate = (useScheduled && scheduledStartDate) ? scheduledStartDate : plannedStartDate
    const breakdown = (useScheduled && job["Scheduled Multi-day Breakdown"]) 
      ? job["Scheduled Multi-day Breakdown"] 
      : job["Planned Multi-day Breakdown"]
      
    // If no breakdown, all hours are on start date
    if (!breakdown) {
      const isStartDate = startDate.getTime() === dateToCheck.getTime()
      if (isStartDate) {
        console.log(`Found match for job ${job.Job} on ${dateToCheck.toISOString()}: ${job["StandardProcessTime (hr)"]} hours`)
      }
      return isStartDate ? job["StandardProcessTime (hr)"] : 0
    }
    
    // Get the day index from the start date
    const dayDiff = Math.floor((dateToCheck.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    if (dayDiff >= 0 && dayDiff < breakdown.length) {
      console.log(`Found breakdown for job ${job.Job} on day ${dayDiff}: ${breakdown[dayDiff]} hours`)
    }
    return dayDiff >= 0 && dayDiff < breakdown.length ? breakdown[dayDiff] : 0
  }

  // Get total scheduled capacity for a resource group on a specific date
  const getScheduledCapacity = (resourceGroupId: string, date: Date, useScheduled: boolean): number => {
    console.log(`\nCalculating capacity for ${resourceGroupId} on ${date.toISOString()} (${useScheduled ? 'Scheduled' : 'Planned'})`)
    
    // Log the filtered jobs first
    const filteredJobs = jobs.value.filter((job: JobData) => job.resourceGroupId === resourceGroupId)
    console.log('Filtered jobs for resource group:', filteredJobs.map(job => ({
      job: job.Job,
      opr: job.Opr,
      resourceGroup: job.resourceGroupId,
      plannedStart: new Date(Number(job["Planned Start Date"])).toISOString(),
      scheduledStart: job["Scheduled Start Date"] ? new Date(Number(job["Scheduled Start Date"])).toISOString() : null,
      processTime: job["StandardProcessTime (hr)"]
    })))

    const totalHours = filteredJobs.reduce((total: number, job: JobData) => {
      return total + getProcessingHoursForDate(job, date, useScheduled)
    }, 0)
    
    console.log(`Total capacity for ${resourceGroupId} on ${date.toISOString()}: ${totalHours} hours\n`)
    return totalHours
  }

  // Get job capacity for a specific job on a specific date
  const getJobCapacity = (jobId: number, date: Date, useScheduled: boolean): number => {
    // Filter operations for this job and sum their processing times
    return jobs.value
      .filter((job: JobData) => job.Job === jobId)
      .reduce((total: number, job: JobData) => {
        return total + getProcessingHoursForDate(job, date, useScheduled)
      }, 0)
  }

  const generateDebugData = (selectedJob?: string, useScheduled = false) => {
    const startDate = new Date('2025-02-24')
    const dates = Array.from({length: 21}, (_, i) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      return date
    })

    return {
      startDate: startDate.toISOString(),
      resourceGroups: resourceGroups.value.map((groupId: string) => {
        return {
          resourceGroupId: groupId,
          dailyData: dates.map(date => {
            const dailyCapacity = data.value.find((d: CapacityData) => d.resourceGroupId === groupId)?.dailyCapacities[0] || 24
            const scheduledPlannedCapacity = getScheduledCapacity(groupId, date, false)
            const scheduledActualCapacity = getScheduledCapacity(groupId, date, true)

            return {
              date: date.toISOString(),
              availableCapacity: dailyCapacity,
              plannedCapacity: scheduledPlannedCapacity,
              scheduledCapacity: scheduledActualCapacity,
              utilization: dailyCapacity > 0 ? scheduledPlannedCapacity / dailyCapacity : 0,
              jobUsage: selectedJob ? {
                [Number(selectedJob)]: {
                  usage: getJobCapacity(Number(selectedJob), date, useScheduled),
                  operation: jobs.value.find(j => j.Job === Number(selectedJob))?.Opr || 0,
                  processTime: jobs.value.find(j => j.Job === Number(selectedJob))?.["StandardProcessTime (hr)"] || 0
                }
              } : {}
            } as DailyData
          })
        }
      })
    }
  }

  const generateAndSaveDebugData = () => {
    const debugData = generateDebugData()
    const jsonStr = JSON.stringify(debugData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'capacity-debug-data.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return debugData
  }

  return {
    data,
    jobs,
    resourceGroups,
    getScheduledCapacity,
    getJobCapacity,
    generateDebugData,
    generateAndSaveDebugData,
    initializeData
  }
} 