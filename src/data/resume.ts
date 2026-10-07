// Based on Vinay_Jakkula_Databricks_Oct26.pdf, with Vinay's requested portfolio edits.
export const professionalResume = {
  summary: 'Senior Data Engineer with 7+ years of experience designing, modernizing, and optimizing enterprise data warehouse and data integration solutions across heterogeneous sources. Hands-on experience across Snowflake, Azure Databricks, Teradata, Hadoop, DB2, Informatica, PySpark, Python, and SQL, with strong expertise in ETL/ELT, data migration, data modeling, data quality, and production optimization. Led a six-member team and large-scale migrations involving 300 tables and 1 TB of data. Built AI-driven data lineage solutions using ChatGPT, Claude, Snowflake LLMs, and Cortex agents, expanding lineage coverage from 1 to 10 product teams.',
  experience: [
    {
      title: 'Data Engineer, Ernst & Young (EY) – Client: Morgan Stanley',
      period: 'Present',
      items: [
        'Consolidated heterogeneous flat files and databases into the enterprise data warehouse to ensure reliable downstream access and data availability.',
        'Led a team of six members, gathering comprehensive requirements and ensuring the consistent, timely delivery of project milestones.',
        'Developed and optimized PySpark-based data processing workflows on Databricks for data transformation, validation, and reliable delivery of curated datasets to downstream systems.',
        'Supported Databricks-based data migration and integration activities, applying ETL and data warehousing patterns to process, validate, and prepare large-scale datasets for downstream consumption.',
        'Spearheaded large-scale data migrations from Teradata and Hadoop to Snowflake, handing over 300 tables and 1 TB of data with minimal downtime and data inconsistency post-cut over.',
        'Built a unified application using ChatGPT and Claude AI agents to capture data lineage, expanding coverage from 1 to 10 Product teams.',
        'Implemented Snowflake LLMs and a Cortex agent to automate cross-system data lineage, improving traceability and query ability.',
        'On boarded new product data end-to-end into the warehouse, ensuring accurate schema mapping and timely data availability.',
        'Developed and optimized ETL/ELT pipelines using Informatica and PySpark, improving processing reliability and enabling on-time delivery of critical downstream data extracts.',
        'Optimized the legacy job framework to remove redundant steps and cut batch processing time from 10 hours to 7 hours.',
      ],
    },
    {
      title: 'Data Engineer, Tata Consultancy Services – Client: Genuine Parts Company',
      period: 'Dec 2018 – May 2022',
      items: [
        'Developed ETL applications and data warehouse mappings to support production workloads with measurable reliability improvements.',
        'Analyzed ETL performance issues, performed root-cause analysis, and delivered fixes with recommendations for long-term stability.',
        'Designed and implemented Informatica mappings, mapplets, and transformations to meet data integration requirements.',
        'Managed code deployments across environments using SVN following standard release processes to ensure consistent releases.',
        'Implemented a Python-based reject reprocessing framework to validate and reprocess error records after loads, improving data recovery efficiency.',
        'Created a Python script to remove line breaks from source files, saving approximately one hour of manual work per day.',
        'Automated daily failure-tracking reports using Python libraries to provide timely visibility into job health.',
        'Delivered development tasks following a DevOps model, coordinating releases and standard practices to meet delivery timelines.',
      ],
    },
  ],
  skills: [
    { title: 'Programming', body: 'Python, SQL, PySpark, Spark SQL, UNIX Shell Scripting' },
    { title: 'Data Platforms', body: 'Snowflake, Azure Databricks, Teradata, Hadoop, DB2' },
    { title: 'Databricks', body: 'PySpark, Delta Lake, Spark SQL, Data Processing, ETL/ELT, Data Migration, Performance Optimization' },
    { title: 'ETL / Integration', body: 'Informatica PowerCenter, ETL/ELT, Data Integration, Data Onboarding, Batch Processing' },
    { title: 'Data Engineering', body: 'Data Warehousing, Data Modeling, Data Migration, Data Quality, Automation, Production Support' },
    { title: 'AI / Modern Data', body: 'ChatGPT, Claude, LLMs, Snowflake Cortex, AI Agents, Data Lineage' },
  ],
  achievements: [
    'Recognized with three consecutive TCS On-The-Spot awards in FY 2021–22, demonstrating exceptional performance.',
    'Garnered the EY Client Extraordinaire award in FY 22–23,FY 24–25,FY 25–26 at Morgan Stanley, exemplifying outstanding contributions to client satisfaction and team success.',
    'Participated in the GRIT (Grass Root Innovation in Technology) Awards 2026 at Morgan Stanley with the AI project JobLens.',
  ],
} as const;
