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
    // This can be empty now or set some initial state
  }

  const updateOperationData = (excelData: any[]) => {
    console.log('Updating operation data:', excelData)
    jobs.value = excelData.map(row => ({
      Job: row.Job,
      Opr: row.Opr,
      resourceGroupId: row.resourceGroupId,
      "Planned Start Date": row["Planned Start Date"],
      "Scheduled Start Date": row["Scheduled Start Date"] || null,
      "StandardProcessTime (hr)": row["StandardProcessTime (hr)"],
      "Scheduled Multi-day Breakdown": row["Scheduled Multi-day Breakdown"],
      "Planned Multi-day Breakdown": row["Planned Multi-day Breakdown"]
    }))
    console.log('Updated jobs:', jobs.value)

    // Create capacity data from unique resource groups
    const uniqueGroups = [...new Set(excelData.map(row => row.resourceGroupId))]
    data.value = uniqueGroups.map(groupId => ({
      resourceGroupId: groupId,
      dailyCapacities: [24, 24, 24, 24, 24, 24, 24] // Default to 24 hours per day
    }))
  }

  const updateCapacityData = (excelData: any[]) => {
    console.log('Updating capacity data:', excelData)
    data.value = excelData.map(row => {
      const allValues = Object.values(row)
      const resourceGroupId = String(allValues[0]).trim()
      const capacities = allValues.slice(1, 8).map(val => {
        const num = Number(val)
        return isNaN(num) ? 24 : num
      })

      return {
        resourceGroupId,
        dailyCapacities: capacities.length === 7 ? capacities : [24, 24, 24, 24, 24, 24, 24]
      }
    })
    console.log('Updated capacity data:', data.value)
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

  const getWeeklyCapacity = (item: CapacityData, date: Date) => {
    // Get day of week (0-6, where 0 is Sunday)
    const dayOfWeek = date.getDay()
    console.log('Getting capacity for', item.resourceGroupId, 'on day', dayOfWeek, ':', item.dailyCapacities[dayOfWeek])
    return item.dailyCapacities[dayOfWeek]
  }

  return {
    data,
    jobs,
    resourceGroups,
    getScheduledCapacity,
    getJobCapacity,
    generateDebugData,
    generateAndSaveDebugData,
    initializeData,
    updateOperationData,
    updateCapacityData,
    getWeeklyCapacity
  }
} 